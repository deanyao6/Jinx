import type { CanonicalGame, CanonicalTeam, GameStatus, LiveState, RosterEntry } from '../../types.js';

export const MLS_PROVIDER = 'espn_mls';

// ESPN omits this played match's venue. The club's official box score confirms it:
// https://www.philadelphiaunion.com/news/box-score-philadelphia-union-4-toronto-fc-0
const VERIFIED_MISSING_VENUES: Readonly<Record<string, { id: string; name: string }>> = {
  '623627': { id: '4061', name: 'Subaru Park' },
};

/** ESPN puts the MLS All-Star exhibition in usa.1 as regular-season. Verified 2026-07. */
export function isMlsLeagueEvent(e: MlsEvent): boolean {
  if (
    /^(all-star-game|mls-is-back---(round-of-16|quarterfinals|semifinals|final))$/.test(
      e.season.slug,
    )
  )
    return false;
  return !e.competitions.some((c) => c.competitors.some((t) => t.team.id === '9817'));
}

export interface MlsTeam {
  id: string;
  displayName: string;
  abbreviation: string;
  shortDisplayName?: string;
  color?: string;
  alternateColor?: string;
}

export interface MlsEvent {
  id: string;
  date: string;
  season: { year: number; type: number; slug: string };
  competitions: {
    date: string;
    neutralSite?: boolean;
    leg?: { value: number; displayValue?: string };
    venue?: { id: string; fullName: string; address?: { city?: string; country?: string } };
    status: {
      type: { name: string; state: string; completed: boolean };
      /** "90'+6'": the match clock at the end, stoppage included. Only the scoreboard has it. */
      displayClock?: string;
      period?: number;
    };
    competitors: {
      homeAway: string;
      team: MlsTeam;
      score?: string;
      shootoutScore?: number;
      aggregateScore?: number;
      winner?: boolean;
    }[];
  }[];
}

export interface MlsScoreboard {
  events: MlsEvent[];
  leagues?: { calendar?: string[]; season?: { year: number; displayName: string } }[];
}

export function parseMlsTeam(t: MlsTeam): CanonicalTeam {
  return {
    provider: MLS_PROVIDER,
    providerTeamId: t.id,
    franchiseId: `mls-${t.id}`,
    sport: 'mls',
    name: t.displayName,
    city: '',
    abbreviation: t.abbreviation,
    active: true,
    primaryColorHex: t.color ? `#${t.color}` : undefined,
    aliases: [...new Set([t.displayName, t.abbreviation, t.shortDisplayName ?? t.displayName])],
  };
}

function score(value: string | number | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid MLS score: ${value}`);
  return n;
}

export function mlsStatus(name: string, state: string, completed: boolean): GameStatus {
  if (/POSTPONED|DELAYED/.test(name)) return 'postponed';
  if (/CANCELED|CANCELLED|ABANDONED/.test(name)) return 'cancelled';
  if (/SUSPENDED|INTERRUPTED/.test(name)) return 'suspended';
  if (completed && /FULL_TIME|FINAL/.test(name)) return 'final';
  if (state === 'in') return 'live';
  if (state === 'pre') return 'scheduled';
  throw new Error(`Unknown MLS status: ${name}/${state}`);
}

/** Refuse unknown competition formats rather than quietly importing other cups. */
export function parseMlsEvent(e: MlsEvent): CanonicalGame {
  if (!isMlsLeagueEvent(e))
    throw new Error('MLS tournaments and exhibitions are outside league coverage');
  const c = e.competitions[0];
  if (!c || e.competitions.length !== 1) throw new Error(`Invalid MLS competition: ${e.id}`);
  const home = c.competitors.find((t) => t.homeAway === 'home');
  const away = c.competitors.find((t) => t.homeAway === 'away');
  if (!home || !away || home.team.id === away.team.id)
    throw new Error(`Invalid MLS teams: ${e.id}`);
  const slug = e.season.slug;
  const historicalPlayoff =
    /^(knockout|semi-finals|semifinals|finals)---(eastern|western)-conf$/.test(slug) ||
    /^(eastern|western)-conference-playoffs---(play-in-round|wild-card|first-round|round-one|semifinals|final|finals)$/.test(
      slug,
    );
  const postseason =
    historicalPlayoff ||
    /^(post-season|postseason|playoffs|mls-cup|final|first-round|wild-card|conference-(semifinals|finals)|conference-semi-finals)$/.test(
      slug,
    );
  if (slug !== 'regular-season' && slug !== `regular-season-${e.season.year}` && !postseason)
    throw new Error(`Unknown MLS season type: ${slug}`);
  // Both the short 2027 and 2027-28 season start in 2027. Provider season metadata must
  // be verified before importing the new format; date guessing would merge two seasons.
  if (e.season.year > 2026) throw new Error('MLS 2027+ season mapping requires verification');
  const s = c.status.type;
  const status = mlsStatus(s.name, s.state, s.completed);
  const hasScore = status === 'live' || status === 'final';
  const homeScore = hasScore ? score(home.score) : null;
  const awayScore = hasScore ? score(away.score) : null;
  if (status === 'final' && (homeScore === null || awayScore === null))
    throw new Error(`Missing MLS final score: ${e.id}`);
  const shootout = status === 'final' && /PEN/.test(s.name);
  const hp = shootout ? score(home.shootoutScore) : null;
  const ap = shootout ? score(away.shootoutScore) : null;
  const seriesShootout = shootout && c.leg?.value === 2;
  if (shootout && c.leg && ![1, 2].includes(c.leg.value))
    throw new Error(`Unknown MLS leg: ${e.id}`);
  const homeAggregate = seriesShootout ? score(home.aggregateScore) : null;
  const awayAggregate = seriesShootout ? score(away.aggregateScore) : null;
  if (
    seriesShootout &&
    (homeAggregate === null || awayAggregate === null || homeAggregate !== awayAggregate)
  )
    throw new Error(`Invalid MLS aggregate shootout: ${e.id}`);
  if (
    shootout &&
    (hp === null || ap === null || hp === ap || (!seriesShootout && homeScore !== awayScore))
  )
    throw new Error(`Invalid MLS shootout: ${e.id}`);
  const winner =
    status !== 'final'
      ? null
      : shootout && !seriesShootout
        ? hp! > ap!
          ? home.team.id
          : away.team.id
        : homeScore === awayScore
          ? null
          : homeScore! > awayScore!
            ? home.team.id
            : away.team.id;
  const start = c.date || e.date;
  if (!Number.isFinite(Date.parse(start))) throw new Error(`Invalid MLS kickoff: ${e.id}`);
  const verifiedVenue = VERIFIED_MISSING_VENUES[e.id];
  return {
    provider: MLS_PROVIDER,
    providerGameId: e.id,
    sport: 'mls',
    season: e.season.year,
    seasonKey: `mls:${e.season.year}`,
    seasonLabel: String(e.season.year),
    gameType: postseason ? 'postseason' : 'regular',
    scheduledStart: new Date(start).toISOString(),
    providerVenueId: c.venue
      ? `espn:${c.venue.id}`
      : verifiedVenue
        ? `espn:${verifiedVenue.id}`
        : null,
    venueName: c.venue?.fullName ?? verifiedVenue?.name ?? null,
    homeProviderTeamId: home.team.id,
    awayProviderTeamId: away.team.id,
    status,
    homeScore,
    awayScore,
    isTie: status === 'final' && winner === null,
    winnerProviderTeamId: winner,
    decisionMethod:
      status !== 'final'
        ? null
        : seriesShootout
          ? 'aggregate_shootout'
          : shootout
            ? 'shootout'
            : /EXTRA|AET/.test(s.name)
              ? 'extra_time'
              : 'regulation',
    homeShootoutScore: hp,
    awayShootoutScore: ap,
    doubleheaderNumber: null,
    rescheduledFromProviderGameId: null,
    rescheduledToProviderGameId: null,
    isNeutralSite: c.neutralSite ?? false,
    finalAt: status === 'final' ? mlsScoreboardFinalAt(start, c.status) : null,
  };
}

/** Minutes of stoppage in a display clock such as "90'+6'" or "45'+3'"; 0 when it has none. */
export function stoppageMinutes(displayClock: string | undefined): number {
  const m = /\+(\d+)'/.exec(displayClock ?? '');
  return m ? Number(m[1]) : 0;
}

/**
 * Roughly when a match ended, from the scoreboard alone, which carries no wall clock
 * (docs/verification.md, 2026-09-22): the scheduled kickoff plus the lag kickoffs were
 * observed to run (11 to 14 minutes), 90 minutes of play, the second half's stoppage from the
 * display clock, an average first-half stoppage, a 17-minute interval, and extra time and a
 * shootout when the period says so. Within about five minutes of the real end on the two
 * matches checked. `ingest/src/mls/finals.ts` replaces it with ESPN's last-play wall clock for
 * the matches someone attended.
 */
export function mlsScoreboardFinalAt(
  start: string,
  status: { displayClock?: string; period?: number },
): string | null {
  const kickoff = Date.parse(start);
  if (!Number.isFinite(kickoff)) return null;
  const period = status.period ?? 2;
  let minutes = 13 + 45 + 3 + 17 + 45 + stoppageMinutes(status.displayClock);
  if (period > 2) minutes += 5 + 30 + 3; // extra time: a break, two halves, its stoppage
  if (period > 4) minutes += 10; // a shootout
  return new Date(kickoff + minutes * 60_000).toISOString();
}

/** The parts of ESPN's `summary?event=` that carry a wall clock (docs/verification.md). */
export interface MlsSummary {
  meta?: { firstPlayWallClock?: string; lastPlayWallClock?: string };
  keyEvents?: {
    type?: { text?: string; type?: string };
    clock?: { value?: number; displayValue?: string };
    period?: { number?: number };
    wallclock?: string;
    text?: string;
  }[];
}

/** How long after kickoff a wall clock can still be the match's own, not a later re-processing. */
const MLS_WALLCLOCK_WINDOW_MS = 4 * 60 * 60_000;

/**
 * When a match ended, from the summary's key events: the latest wall clock among them (which is
 * `meta.lastPlayWallClock`), accepted only when it falls within four hours after the scheduled
 * kickoff. Older matches carry ESPN's re-processing timestamps instead (a 2016 match "ending" in
 * 2021), which the window refuses; the caller keeps the scoreboard estimate then.
 */
export function mlsSummaryFinalAt(summary: MlsSummary, scheduledStart: string): string | null {
  const kickoff = Date.parse(scheduledStart);
  if (!Number.isFinite(kickoff)) return null;
  const stamps = [
    ...(summary.keyEvents ?? []).map((e) => e.wallclock),
    summary.meta?.lastPlayWallClock,
  ]
    .map((w) => (w ? Date.parse(w) : NaN))
    .filter((t) => Number.isFinite(t));
  if (stamps.length === 0) return null;
  const last = Math.max(...stamps);
  if (last < kickoff || last > kickoff + MLS_WALLCLOCK_WINDOW_MS) return null;
  return new Date(last).toISOString();
}

/** The header of ESPN's `summary?event=`: the match's status and scores, one request per match. */
export interface MlsSummaryHeader {
  header?: {
    competitions?: {
      date?: string;
      status?: {
        type: { name: string; state: string; completed: boolean };
        displayClock?: string;
        period?: number;
      };
      competitors?: { homeAway: 'home' | 'away'; score?: string | number }[];
    }[];
  };
}

/**
 * A match as the app's live feed reads it (SPEC 6.4; decision 8, 2026-09-22): the period is the
 * half (3 and 4 for extra time, 5 for a shootout), the state is `halftime` between the halves,
 * `live` during play, `end` when it is over, and the clock is ESPN's display clock ("67'",
 * "90'+4'"). Scores are goals; shootout kicks are not in them.
 */
export function parseMlsLiveState(doc: MlsSummaryHeader, fetchedAt: string): LiveState | null {
  const c = doc.header?.competitions?.[0];
  if (!c?.status) return null;
  const t = c.status.type;
  const status = mlsStatus(t.name, t.state, t.completed);
  const home = c.competitors?.find((x) => x.homeAway === 'home');
  const away = c.competitors?.find((x) => x.homeAway === 'away');
  const halftime = /HALFTIME/.test(t.name);
  let inningState: LiveState['inningState'] = null;
  if (status === 'final') inningState = 'end';
  else if (status === 'live') inningState = halftime ? 'halftime' : 'live';
  return {
    status,
    inning: status === 'scheduled' ? null : (c.status.period ?? null),
    inningState,
    clock: status === 'live' && !halftime ? (c.status.displayClock ?? null) : null,
    homeScore: score(home?.score) ?? 0,
    awayScore: score(away?.score) ?? 0,
    fetchedAt,
  };
}

/** ESPN's `teams/{id}/roster`: one athlete per row (docs/verification.md, 2026-09-22). */
export interface MlsRoster {
  athletes?: {
    id: string | number;
    displayName?: string;
    fullName?: string;
    jersey?: string;
    position?: { abbreviation?: string; displayName?: string };
  }[];
}

/** Today's squad as the favourites picker lists it. ESPN carries no status; every row is active. */
export function parseMlsRoster(doc: MlsRoster): RosterEntry[] {
  const out: RosterEntry[] = [];
  const seen = new Set<string>();
  for (const a of doc.athletes ?? []) {
    const id = String(a.id);
    const name = (a.displayName ?? a.fullName ?? '').trim();
    if (!name || seen.has(id)) continue;
    seen.add(id);
    out.push({
      providerPlayerId: id,
      fullName: name,
      position: a.position?.abbreviation ?? null,
      jersey: a.jersey ? String(a.jersey) : null,
      status: 'A',
    });
  }
  return out;
}
