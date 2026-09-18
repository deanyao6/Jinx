/**
 * Famous games, superstars and personal badges: the pure rules (docs/prompts/famous-games.md).
 *
 * The database mirrors each of these in SQL (20260918000100_famous_games.sql), and that copy
 * is the one the app reads. These exist so the ingest scripts and the app share one definition
 * of the words and the windows, and so each rule has a unit test with no database behind it.
 * No I/O, Deno-safe: this file is synced into the Edge Functions.
 */

// ---------------------------------------------------------------------------
// Local dates
// ---------------------------------------------------------------------------

/**
 * The calendar date a game was played on, where it was played. `games.scheduled_start` is UTC,
 * so an 8 pm Eastern game is already tomorrow there; matching a curated entry by UTC date
 * missed the 2022 World Series Game 3, Tom Brady's last game and Freddie Freeman's grand slam.
 * A venue without a timezone (most NFL parks) is read in Eastern time: every game in these
 * leagues starts between 9 am and 11 pm ET, so that is the right day for any venue in the
 * Americas and for London. Same rule as `public.game_local_date`.
 */
export function localDateOf(startIso: string, tz: string | null | undefined): string {
  const zone = tz && tz.length > 0 ? tz : 'America/New_York';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(startIso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ---------------------------------------------------------------------------
// The curated matcher
// ---------------------------------------------------------------------------

export type FamousCategory = 'championship' | 'playoff' | 'record' | 'debut' | 'farewell';

/** One object in seed/famous_games.json. */
export interface CuratedFamousGame {
  sport: string;
  /** The game's local date, YYYY-MM-DD. */
  local_date: string;
  /** Team abbreviations as in `teams`, for the season in question (OAK in 2019, LV in 2020). */
  home: string;
  away: string;
  /** Doubleheaders only: which game of the day. */
  game_number?: number;
  category: FamousCategory;
  title: string;
  story: string;
  /** Whom the entry is about: the league, or one team by abbreviation. */
  about: 'league' | { team: string };
}

/** What the matcher needs to know about a game. */
export interface MatchableGame {
  id: string;
  sport_id: string;
  scheduled_start: string;
  venue_tz: string | null;
  home_abbreviation: string;
  away_abbreviation: string;
  doubleheader_number: number | null;
}

/**
 * The games a curated entry names: same sport, same two sides, same local date, and the same
 * game of a doubleheader when the entry says which. Exactly one is a match; zero and more than
 * one are both errors the caller must refuse on, never guess.
 */
export function matchCuratedGame(entry: CuratedFamousGame, games: readonly MatchableGame[]): MatchableGame[] {
  return games.filter(
    (g) =>
      g.sport_id === entry.sport &&
      g.home_abbreviation === entry.home &&
      g.away_abbreviation === entry.away &&
      localDateOf(g.scheduled_start, g.venue_tz) === entry.local_date &&
      (entry.game_number == null || g.doubleheader_number === entry.game_number),
  );
}

// ---------------------------------------------------------------------------
// Superstars
// ---------------------------------------------------------------------------

/** Z: how many seasons after an honor a player is still a star for it. Decided by Dean. */
export const SUPERSTAR_WINDOW_SEASONS = 3;

/**
 * A player is a superstar for a season when they met an award bar in that season or any of the
 * previous `window` seasons.
 */
export function isSuperstarSeason(
  honorSeasons: readonly number[],
  season: number,
  window = SUPERSTAR_WINDOW_SEASONS,
): boolean {
  return honorSeasons.some((s) => s <= season && s >= season - window);
}

/** "MVP 2023", "2024 All-Star": what a star's caption says on a game page. */
export function honorCaption(input: { label: string; season: number; seasonFirst: boolean }): string {
  return input.seasonFirst ? `${input.season} ${input.label}` : `${input.label} ${input.season}`;
}

// ---------------------------------------------------------------------------
// Personal badges
// ---------------------------------------------------------------------------

export type PersonalBadgeKind = 'first_days' | 'debut' | 'rookie' | 'first_td';

/** How long after joining a team a game still counts as the player's first days there. */
export const FIRST_DAYS_WINDOW = 14;

/**
 * "Phillies" -> "Phillie", "Eagles" -> "Eagle", "Red Sox" -> null (no singular: say "with the
 * Red Sox"). Only the plain plural is turned into a singular; anything else is left alone.
 */
export function singularNickname(nickname: string): string | null {
  const n = nickname.trim();
  if (n.length < 3) return null;
  if (/ss$/i.test(n) || /x$/i.test(n)) return null;
  if (/ies$/i.test(n)) return n.replace(/ies$/i, 'ie');
  if (/s$/i.test(n)) return n.slice(0, -1);
  return null;
}

/** "a Phillie", "an Eagle", "an Athletic". */
export function withArticle(word: string): string {
  return `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`;
}

/** "Bryce Harper’s": a curly apostrophe, as the feed copy writes it. */
function possessive(name: string): string {
  return `${name}\u2019s`;
}

export interface PersonalBadgeInput {
  kind: PersonalBadgeKind | string;
  playerName: string;
  /** The team the badge is about, for first_days. */
  teamNickname?: string | null;
  /** The sport, for "MLB debut". */
  sportId?: string | null;
}

/**
 * The title of a personal badge. "First days as a Phillie", not "first home game": appearances
 * exist only for logged games, so the app cannot know whether the player appeared in an
 * earlier, unlogged game. Fourteen days after the join is what can be proven.
 */
export function personalBadgeTitle(input: PersonalBadgeInput): string {
  const who = possessive(input.playerName);
  switch (input.kind) {
    case 'first_days': {
      const nick = input.teamNickname?.trim();
      if (!nick) return `Saw ${who} first days with a new team`;
      const one = singularNickname(nick);
      return one ? `Saw ${who} first days as ${withArticle(one)}` : `Saw ${who} first days with the ${nick}`;
    }
    case 'debut': {
      const league = input.sportId ? `${input.sportId.toUpperCase()} ` : '';
      return `Saw ${who} ${league}debut`;
    }
    case 'rookie':
      return `Saw ${who} rookie season`;
    case 'first_td':
      return `Saw ${who} first touchdown`;
    default:
      return `Saw ${who} ${String(input.kind).replace(/_/g, ' ')}`;
  }
}

/** The one line under a personal badge that says why it counts, when a fan taps for it. */
export function personalBadgeExplanation(kind: PersonalBadgeKind | string): string {
  switch (kind) {
    case 'first_days':
      return `You were at a game within ${FIRST_DAYS_WINDOW} days of the player joining the team, and the player appeared. Only games you logged are known, so this is what can be proven.`;
    case 'debut':
      return 'You were at the game on the day of the player’s league debut, and the player appeared.';
    case 'rookie':
      return 'You were at a game in the player’s rookie season, and the player appeared.';
    case 'first_td':
      return 'You were at the game of the player’s first touchdown.';
    default:
      return 'You were there, and the player appeared.';
  }
}

// ---------------------------------------------------------------------------
// Firsts from play-by-play, joins from rosters and transactions
// ---------------------------------------------------------------------------

/** A scoring play as `firstTouchdowns` needs it, already in chronological order. */
export interface TouchdownPlay {
  providerGameId: string;
  scorerProviderId: string | null;
  touchdown: boolean;
}

/**
 * Each player's first touchdown: the game of the first play that scored one with them named.
 * The caller supplies plays in order (season, week, game, play), so "first" is the first seen.
 */
export function firstTouchdowns(plays: Iterable<TouchdownPlay>): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of plays) {
    if (!p.touchdown || !p.scorerProviderId) continue;
    if (!out.has(p.scorerProviderId)) out.set(p.scorerProviderId, p.providerGameId);
  }
  return out;
}

/** A weekly roster row as `rosterJoins` needs it. */
export interface RosterWeekRow {
  season: number;
  week: number;
  team: string;
  gsisId: string;
  /** Rookie season from the players file, when known; a rookie's first week is a join. */
  rookieSeason?: number | null;
}

export interface RosterJoin {
  gsisId: string;
  team: string;
  season: number;
  week: number;
}

/**
 * When a player joined a team, from weekly rosters: the first week they appear on a team that
 * is not the one they were on the week before (across seasons too, so an offseason signing is
 * a week-1 join). The first row ever seen for a player is a join only when it is their rookie
 * season; otherwise the history before the range is unknown and nothing is claimed.
 */
export function rosterJoins(rows: Iterable<RosterWeekRow>): RosterJoin[] {
  const sorted = [...rows].sort(
    (a, b) => a.gsisId.localeCompare(b.gsisId) || a.season - b.season || a.week - b.week,
  );
  const out: RosterJoin[] = [];
  let current: { gsisId: string; team: string } | null = null;
  for (const r of sorted) {
    if (!current || current.gsisId !== r.gsisId) {
      current = { gsisId: r.gsisId, team: r.team };
      if (r.rookieSeason != null && r.rookieSeason === r.season) {
        out.push({ gsisId: r.gsisId, team: r.team, season: r.season, week: r.week });
      }
      continue;
    }
    if (current.team !== r.team) {
      current.team = r.team;
      out.push({ gsisId: r.gsisId, team: r.team, season: r.season, week: r.week });
    }
  }
  return out;
}

/**
 * Transaction type codes that mean a player joined the `toTeam` (docs/verification.md).
 * Recalls (CU) and contract selections (SE) are left out on purpose: they move a player who
 * already belongs to the organization, and would turn every call-up into "first days".
 */
export const MLB_JOIN_KINDS: Readonly<Record<string, string>> = {
  TR: 'trade',
  SFA: 'signing',
  SGN: 'signing',
  CLW: 'waivers',
  R5: 'rule_5',
  PUR: 'purchase',
};

export interface MlbTransactionLike {
  person?: { id: number; fullName?: string };
  toTeam?: { id: number };
  date: string;
  typeCode: string;
}

export interface MlbJoin {
  providerPlayerId: string;
  providerTeamId: string;
  joinedOn: string;
  kind: string;
  fullName: string | null;
}

/**
 * The joins in a team's transaction list: rows of a join kind whose destination is a major
 * league team. A trade lists one row per player moved, each with the team he went to, so the
 * filter is by `toTeam`, and a teamId the caller cares about (a minor-league affiliate's id
 * appears on rehab assignments, which are not joins).
 */
export function mlbJoins(transactions: Iterable<MlbTransactionLike>, isMajorLeagueTeam: (id: string) => boolean): MlbJoin[] {
  const out: MlbJoin[] = [];
  const seen = new Set<string>();
  for (const t of transactions) {
    const kind = MLB_JOIN_KINDS[t.typeCode];
    if (!kind || !t.person?.id || !t.toTeam?.id) continue;
    const teamId = String(t.toTeam.id);
    if (!isMajorLeagueTeam(teamId)) continue;
    const key = `${t.person.id}:${teamId}:${t.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      providerPlayerId: String(t.person.id),
      providerTeamId: teamId,
      joinedOn: t.date,
      kind,
      fullName: t.person.fullName ?? null,
    });
  }
  return out;
}
