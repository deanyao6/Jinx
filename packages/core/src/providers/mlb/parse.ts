/**
 * MLB Stats API -> canonical types. Pure functions over the JSON documents returned by
 * `v1/schedule`, `v1.1/game/{gamePk}/feed/live`, `v1/teams`, and `v1/teams/{id}/roster`.
 * Field names are verified in docs/verification.md.
 */
import type {
  Appearance,
  CanonicalGame,
  CanonicalGameDetail,
  CanonicalTeam,
  GameStatus,
  GameType,
  LiveState,
  MlbPlay,
  RosterEntry,
  RunScoredOn,
  ScoringEvent,
  Side,
} from '../../types.js';
import { mlbScorer } from '../../scoring.js';

// ---------------------------------------------------------------------------
// Minimal shapes of the provider documents (only the fields we read)
// ---------------------------------------------------------------------------

export interface MlbStatus {
  abstractGameState?: string;
  codedGameState?: string;
  detailedState?: string;
  statusCode?: string;
  reason?: string;
}

export interface MlbScheduleGame {
  gamePk: number;
  gameType: string;
  season: string | number;
  gameDate: string;
  officialDate?: string;
  status: MlbStatus;
  teams: {
    home: { team: { id: number; name: string }; score?: number; isWinner?: boolean };
    away: { team: { id: number; name: string }; score?: number; isWinner?: boolean };
  };
  venue?: { id: number; name: string };
  isTie?: boolean;
  doubleHeader?: string;
  gameNumber?: number;
  rescheduleDate?: string;
  rescheduledFrom?: number | null;
  rescheduledTo?: number | null;
  resumeDate?: string;
  resumedFrom?: number | null;
  scheduledInnings?: number;
}

export interface MlbScheduleResponse {
  dates: { date: string; games: MlbScheduleGame[] }[];
}

export interface MlbTeamsResponse {
  teams: {
    id: number;
    name: string;
    teamName?: string;
    locationName?: string;
    abbreviation?: string;
    shortName?: string;
    franchiseName?: string;
    clubName?: string;
    active?: boolean;
    venue?: { id: number; name: string };
  }[];
}

/** `v1/teams/{teamId}/roster?rosterType=40Man` (docs/verification.md). */
export interface MlbRosterResponse {
  teamId?: number;
  rosterType?: string;
  roster: {
    person: { id: number; fullName: string };
    jerseyNumber?: string;
    position?: { code?: string; name?: string; type?: string; abbreviation?: string };
    status?: { code?: string; description?: string };
    parentTeamId?: number;
    note?: string;
  }[];
}

export interface MlbPlayEvent {
  isPitch?: boolean;
  type?: string;
  details?: { isStrike?: boolean; isBall?: boolean; isInPlay?: boolean; code?: string };
}

export interface MlbAllPlay {
  result: {
    type?: string;
    event?: string;
    eventType?: string;
    description?: string;
    rbi?: number;
    awayScore?: number;
    homeScore?: number;
    isOut?: boolean;
  };
  about: {
    atBatIndex: number;
    halfInning: 'top' | 'bottom';
    inning: number;
    startTime?: string;
    endTime?: string;
    isComplete?: boolean;
    isScoringPlay?: boolean;
  };
  count?: { balls?: number; strikes?: number; outs?: number };
  matchup?: {
    batter?: { id: number; fullName: string };
    pitcher?: { id: number; fullName: string };
    postOnFirst?: { id: number };
    postOnSecond?: { id: number };
    postOnThird?: { id: number };
  };
  playEvents?: MlbPlayEvent[];
  playEndTime?: string;
  runners?: MlbRunner[];
}

/** One runner movement on a play; a run that scored mid-plate-appearance is found here. */
export interface MlbRunner {
  movement?: { start?: string | null; end?: string | null; isOut?: boolean };
  details?: {
    event?: string;
    eventType?: string;
    runner?: { id: number; fullName: string };
    isScoringEvent?: boolean;
    rbi?: boolean;
  };
}

export interface MlbBoxscoreTeam {
  team?: { id: number; name: string };
  players?: Record<string, { person: { id: number; fullName: string } }>;
  batters?: number[];
  pitchers?: number[];
}

export interface MlbFeed {
  gamePk: number;
  gameData: {
    game?: { type?: string; season?: string; doubleHeader?: string; gameNumber?: number };
    datetime: { dateTime: string; officialDate?: string };
    status: MlbStatus;
    teams: {
      home: { id: number; name: string; venue?: { id: number } };
      away: { id: number; name: string; venue?: { id: number } };
    };
    venue: { id: number; name: string };
    weather?: { condition?: string; temp?: string; wind?: string };
    gameInfo?: { attendance?: number; firstPitch?: string; gameDurationMinutes?: number };
  };
  liveData: {
    linescore?: {
      currentInning?: number;
      inningState?: string;
      isTopInning?: boolean;
      scheduledInnings?: number;
      innings?: { num: number }[];
      teams?: {
        home?: { runs?: number; hits?: number };
        away?: { runs?: number; hits?: number };
      };
    };
    boxscore?: { teams?: { home?: MlbBoxscoreTeam; away?: MlbBoxscoreTeam } };
    plays?: { allPlays?: MlbAllPlay[]; scoringPlays?: number[] };
  };
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

export function mapMlbStatus(status: MlbStatus): GameStatus {
  const detailed = (status.detailedState ?? '').toLowerCase();
  if (detailed.startsWith('postponed')) return 'postponed';
  if (detailed.startsWith('cancelled') || detailed.startsWith('canceled')) return 'cancelled';
  if (detailed.startsWith('suspended')) return 'suspended';
  const abstract = (status.abstractGameState ?? '').toLowerCase();
  if (abstract === 'final') return 'final';
  if (abstract === 'live') return 'live';
  return 'scheduled';
}

/** Returns null for game types we do not ingest (All-Star game, exhibitions we cannot classify). */
export function mapMlbGameType(code: string): GameType | null {
  switch (code) {
    case 'R':
      return 'regular';
    case 'F':
    case 'D':
    case 'L':
    case 'W':
      return 'postseason';
    // Spring training (S) and exhibitions (E) are not stored: only regular season and
    // postseason games exist in Jinx (Dean, 2026-09-22). The schedule request no longer asks
    // for them either; this keeps one out should a feed ever carry one.
    case 'S':
    case 'E':
    default:
      return null;
  }
}

export interface ScheduleParseOptions {
  /** MLB team id -> MLB home venue id for the season, used to flag neutral sites. */
  homeVenueIdByTeamId?: Record<string, number> | undefined;
}

export function parseMlbScheduleGame(
  g: MlbScheduleGame,
  opts: ScheduleParseOptions = {},
): CanonicalGame | null {
  const gameType = mapMlbGameType(g.gameType);
  if (!gameType) return null;
  const status = mapMlbStatus(g.status);
  const homeScore = status === 'final' ? (g.teams.home.score ?? null) : null;
  const awayScore = status === 'final' ? (g.teams.away.score ?? null) : null;
  const homeVenue = opts.homeVenueIdByTeamId?.[String(g.teams.home.team.id)];
  const isNeutralSite =
    homeVenue !== undefined && g.venue !== undefined && homeVenue !== g.venue.id;
  const dh = g.doubleHeader === 'Y' || g.doubleHeader === 'S';
  return {
    provider: 'mlb',
    providerGameId: String(g.gamePk),
    sport: 'mlb',
    season: Number(g.season),
    gameType,
    scheduledStart: g.gameDate,
    providerVenueId: g.venue ? String(g.venue.id) : null,
    venueName: g.venue?.name ?? null,
    homeProviderTeamId: String(g.teams.home.team.id),
    awayProviderTeamId: String(g.teams.away.team.id),
    status,
    homeScore,
    awayScore,
    isTie: status === 'final' && homeScore !== null && homeScore === awayScore,
    doubleheaderNumber: dh ? (g.gameNumber ?? 1) : null,
    rescheduledFromProviderGameId: g.rescheduledFrom ? String(g.rescheduledFrom) : null,
    rescheduledToProviderGameId: g.rescheduledTo ? String(g.rescheduledTo) : null,
    isNeutralSite,
    finalAt: null,
  };
}

export function parseMlbSchedule(
  doc: MlbScheduleResponse,
  opts: ScheduleParseOptions = {},
): CanonicalGame[] {
  const out: CanonicalGame[] = [];
  for (const day of doc.dates ?? []) {
    for (const g of day.games ?? []) {
      const parsed = parseMlbScheduleGame(g, opts);
      if (parsed) out.push(parsed);
    }
  }
  return out;
}

export function parseMlbTeams(doc: MlbTeamsResponse): CanonicalTeam[] {
  return doc.teams.map((t) => {
    const aliases = new Set<string>();
    for (const v of [
      t.name,
      t.teamName,
      t.locationName,
      t.abbreviation,
      t.shortName,
      t.franchiseName,
      t.clubName,
    ]) {
      if (v) aliases.add(v);
    }
    return {
      provider: 'mlb',
      providerTeamId: String(t.id),
      franchiseId: `mlb-${t.id}`,
      sport: 'mlb',
      name: t.name,
      city: t.locationName ?? '',
      abbreviation: t.abbreviation ?? '',
      active: t.active ?? true,
      aliases: [...aliases],
    };
  });
}

function parseTemp(temp: string | undefined): number | null {
  if (temp === undefined || temp === null || temp === '') return null;
  const n = Number(temp);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function isStrikePitch(e: MlbPlayEvent): boolean {
  // A foul with two strikes is a strike pitch but does not advance the count; for an immaculate
  // inning every pitch must be a strike and the strikeout must take exactly three pitches, so the
  // simple "isStrike or in play" test is enough here.
  return e.isPitch === true && (e.details?.isStrike === true || e.details?.isInPlay === true);
}

export function parseMlbPlays(feed: MlbFeed): MlbPlay[] {
  const all = feed.liveData.plays?.allPlays ?? [];
  const out: MlbPlay[] = [];
  let prevHalfKey = '';
  let runnersOnAfterPrev = 0;
  for (const p of all) {
    if (p.about.isComplete === false) continue;
    const halfKey = `${p.about.inning}-${p.about.halfInning}`;
    if (halfKey !== prevHalfKey) {
      runnersOnAfterPrev = 0;
      prevHalfKey = halfKey;
    }
    const pitches = (p.playEvents ?? []).filter((e) => e.isPitch === true);
    const eventType = p.result.eventType ?? '';
    const battingSide: Side = p.about.halfInning === 'top' ? 'away' : 'home';
    out.push({
      index: p.about.atBatIndex,
      inning: p.about.inning,
      half: p.about.halfInning,
      startTime: p.about.startTime ?? null,
      endTime: p.about.endTime ?? p.playEndTime ?? null,
      eventType,
      event: p.result.event ?? '',
      description: p.result.description ?? '',
      rbi: p.result.rbi ?? 0,
      homeScore: p.result.homeScore ?? 0,
      awayScore: p.result.awayScore ?? 0,
      isScoringPlay: p.about.isScoringPlay === true,
      isOut: p.result.isOut === true,
      outsAfter: p.count?.outs ?? 0,
      batterId: p.matchup?.batter ? String(p.matchup.batter.id) : '',
      batterName: p.matchup?.batter?.fullName ?? '',
      pitcherId: p.matchup?.pitcher ? String(p.matchup.pitcher.id) : '',
      pitcherName: p.matchup?.pitcher?.fullName ?? '',
      battingSide,
      pitchCount: pitches.length,
      allStrikes:
        eventType === 'strikeout' && pitches.length === 3 && pitches.every((e) => isStrikePitch(e)),
      runnersOnStart: runnersOnAfterPrev,
      runScoredOn: runScoredOn(p),
    });
    const m = p.matchup;
    runnersOnAfterPrev =
      (m?.postOnFirst ? 1 : 0) + (m?.postOnSecond ? 1 : 0) + (m?.postOnThird ? 1 : 0);
  }
  return out;
}

/**
 * The event a run came home on when it was not the plate appearance's own result: the
 * scoring runner movement whose event differs from the play's. "Matt Carpenter strikes out
 * swinging" under a changed score was a wild pitch; this is where the feed says so.
 */
export function runScoredOn(p: Pick<MlbAllPlay, 'result' | 'runners'>): RunScoredOn | null {
  const own = p.result.eventType ?? '';
  for (const r of p.runners ?? []) {
    const d = r.details;
    if (!d || d.isScoringEvent !== true || r.movement?.end !== 'score') continue;
    const eventType = d.eventType ?? '';
    if (eventType === own) continue;
    return {
      eventType,
      event: d.event ?? '',
      runnerId: d.runner ? String(d.runner.id) : '',
      runnerName: d.runner?.fullName ?? '',
    };
  }
  return null;
}

export function buildMlbTimeline(plays: MlbPlay[]): ScoringEvent[] {
  const events: ScoringEvent[] = [];
  let home = 0;
  let away = 0;
  for (const p of plays) {
    if (p.homeScore === home && p.awayScore === away) continue;
    const scoringSide: Side = p.homeScore > home ? 'home' : 'away';
    home = p.homeScore;
    away = p.awayScore;
    events.push({
      seq: events.length + 1,
      occurredAt: p.endTime,
      period: p.inning,
      half: p.half,
      clock: null,
      homeScore: home,
      awayScore: away,
      scoringSide,
      description: p.description,
      ...mlbScorer(p),
    });
  }
  return events;
}

function appearancesFor(team: MlbBoxscoreTeam | undefined): Appearance[] {
  if (!team?.team) return [];
  const ids = new Set<number>([...(team.batters ?? []), ...(team.pitchers ?? [])]);
  const out: Appearance[] = [];
  for (const id of ids) {
    const p = team.players?.[`ID${id}`];
    out.push({
      providerPlayerId: String(id),
      fullName: p?.person.fullName ?? `Player ${id}`,
      providerTeamId: String(team.team.id),
    });
  }
  return out;
}

export function parseMlbFeed(feed: MlbFeed): CanonicalGameDetail {
  const gd = feed.gameData;
  const ld = feed.liveData;
  const status = mapMlbStatus(gd.status);
  const gameType = mapMlbGameType(gd.game?.type ?? 'R') ?? 'regular';
  const plays = parseMlbPlays(feed);
  const timeline = buildMlbTimeline(plays);
  const homeRuns = ld.linescore?.teams?.home?.runs ?? null;
  const awayRuns = ld.linescore?.teams?.away?.runs ?? null;
  const homeScore = status === 'final' ? homeRuns : null;
  const awayScore = status === 'final' ? awayRuns : null;
  const innings = ld.linescore?.innings?.length ?? ld.linescore?.currentInning ?? null;
  const firstInningPlays = plays.filter((p) => p.inning === 1);
  const timestampsReliable =
    plays.length > 0 &&
    timeline.every((e) => e.occurredAt !== null) &&
    firstInningPlays.every((p) => p.endTime !== null);
  const homeVenue = gd.teams.home.venue?.id;
  const dh = gd.game?.doubleHeader === 'Y' || gd.game?.doubleHeader === 'S';
  const lastPlay = plays[plays.length - 1];
  return {
    provider: 'mlb',
    providerGameId: String(feed.gamePk),
    sport: 'mlb',
    season: Number(gd.game?.season ?? gd.datetime.dateTime.slice(0, 4)),
    gameType,
    scheduledStart: gd.datetime.dateTime,
    providerVenueId: String(gd.venue.id),
    venueName: gd.venue.name,
    homeProviderTeamId: String(gd.teams.home.id),
    awayProviderTeamId: String(gd.teams.away.id),
    status,
    homeScore,
    awayScore,
    isTie: status === 'final' && homeScore !== null && homeScore === awayScore,
    doubleheaderNumber: dh ? (gd.game?.gameNumber ?? 1) : null,
    rescheduledFromProviderGameId: null,
    rescheduledToProviderGameId: null,
    isNeutralSite: homeVenue !== undefined && homeVenue !== gd.venue.id,
    finalAt: status === 'final' ? (lastPlay?.endTime ?? null) : null,
    temperatureF: parseTemp(gd.weather?.temp),
    durationMinutes: gd.gameInfo?.gameDurationMinutes ?? null,
    attendance: gd.gameInfo?.attendance ?? null,
    inningsOrPeriods: innings,
    appearances: [
      ...appearancesFor(ld.boxscore?.teams?.home),
      ...appearancesFor(ld.boxscore?.teams?.away),
    ],
    timeline,
    timestampsReliable,
    plays: { sport: 'mlb', items: plays },
    hits: {
      home: ld.linescore?.teams?.home?.hits ?? 0,
      away: ld.linescore?.teams?.away?.hits ?? 0,
    },
  };
}

export function parseMlbLiveState(feed: MlbFeed, fetchedAt: string): LiveState {
  const ls = feed.liveData.linescore;
  const state = (ls?.inningState ?? '').toLowerCase();
  const inningState =
    state === 'top' || state === 'middle' || state === 'bottom' || state === 'end' ? state : null;
  return {
    status: mapMlbStatus(feed.gameData.status),
    inning: ls?.currentInning ?? null,
    inningState,
    homeScore: ls?.teams?.home?.runs ?? 0,
    awayScore: ls?.teams?.away?.runs ?? 0,
    fetchedAt,
  };
}

/**
 * Status codes that mean "on the big-league team today": active, or on an injured list (D7,
 * D10, D15, D60). The 40-man also carries `RM` (reassigned to minors) and `NYR` (not yet
 * reported), who are under contract but not on the team a fan watches, so they are left out.
 */
export function isMlbRosterStatus(code: string | null | undefined): boolean {
  if (!code) return false;
  return code === 'A' || /^D\d+$/.test(code);
}

/** The 40-man roster document, kept to active and injured players. */
export function parseMlbRoster(doc: MlbRosterResponse): RosterEntry[] {
  const out: RosterEntry[] = [];
  const seen = new Set<string>();
  for (const r of doc.roster ?? []) {
    const status = r.status?.code ?? null;
    if (!isMlbRosterStatus(status)) continue;
    const id = String(r.person.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const jersey = r.jerseyNumber?.trim();
    out.push({
      providerPlayerId: id,
      fullName: r.person.fullName,
      position: r.position?.abbreviation ?? null,
      jersey: jersey ? jersey : null,
      status,
    });
  }
  return out;
}
