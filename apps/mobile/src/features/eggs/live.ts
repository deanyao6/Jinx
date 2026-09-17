/**
 * The two eggs that need a live game: the rally cap and the stretch-time confetti
 * (Dean, 2026-09-17).
 *
 * Pure rules only, and sport-neutral by construction: everything a sport decides is one row of
 * {@link EGG_SPORTS}. A new sport adds a row and nothing else. A sport with no row has neither
 * egg.
 */

/** The small drawn things that fall. Drawn in `pieces.tsx`, one component per kind. */
export type PieceKind = 'peanut' | 'snackBox' | 'baseball' | 'football' | 'whistle' | 'yardFlag';

export type EggSport = {
  /**
   * Whether `game_live_state` is written for this sport. It is the one switch that says "there
   * is live data": with it off nothing is polled and neither live egg can fire for the sport.
   *
   * NFL is off because v1 has no live NFL data at all (SPEC.md 4.3: nflverse publishes after
   * the game). The NFL row is complete otherwise, so the day a live NFL feed writes
   * `game_live_state` (the quarter in `inning`, the state in `inning_state`) this flips to
   * true and both eggs light up with no other change.
   */
  liveFeed: boolean;
  /** Rally cap: the period from which the game is late. The 7th inning, the 4th quarter. */
  lateFrom: number;
  /** The sport's signature break: which periods it falls in, and the states that mean "now". */
  signatureBreak: { name: string; periods: readonly number[]; states: readonly string[] };
  /** What falls during it. */
  pieces: readonly PieceKind[];
};

export const EGG_SPORTS: Readonly<Record<string, EggSport>> = {
  mlb: {
    liveFeed: true,
    lateFrom: 7,
    // The MLB feed's linescore.inningState is Top, Middle, Bottom or End, stored lower-cased
    // (parseMlbLiveState in packages/core). "Middle" of the 7th is the stretch itself: the top
    // half is over and the bottom has not begun.
    signatureBreak: { name: 'Seventh-inning stretch', periods: [7], states: ['middle'] },
    pieces: ['peanut', 'snackBox', 'baseball'],
  },
  nfl: {
    liveFeed: false,
    lateFrom: 4,
    // One before each half. No feed writes this state yet; the name is what one should write.
    signatureBreak: {
      name: 'Two-minute warning',
      periods: [2, 4],
      states: ['two_minute_warning'],
    },
    pieces: ['football', 'whistle', 'yardFlag'],
  },
};

/** Whether the app has live state to read for this sport today. */
export function hasLiveFeed(sport: string | null | undefined): boolean {
  return !!sport && EGG_SPORTS[sport]?.liveFeed === true;
}

/** A live game, with the sport's own words taken out: an inning and a quarter are a period. */
export type EggLive = {
  status: string;
  period: number | null;
  periodState: string | null;
  homeScore: number;
  awayScore: number;
};

/** A `game_live_state` row. The columns are named for baseball; the meaning is not. */
export type LiveStateRow = {
  status: string;
  inning: number | null;
  inning_state: string | null;
  home_score: number;
  away_score: number;
};

export function eggLiveFrom(row: LiveStateRow | null | undefined): EggLive | null {
  if (!row) return null;
  return {
    status: row.status,
    period: row.inning,
    periodState: row.inning_state ? row.inning_state.toLowerCase() : null,
    homeScore: row.home_score,
    awayScore: row.away_score,
  };
}

export type Side = 'home' | 'away';

/**
 * Rally cap: the game is live, the person has a side, that side is behind, and it is late.
 * Level is not behind. A neutral has no cap to flip.
 */
export function rallyCapEligible(input: {
  sport: string | null | undefined;
  live: EggLive | null | undefined;
  rootingSide: Side | null | undefined;
}): boolean {
  const { sport, live, rootingSide } = input;
  const row = sport ? EGG_SPORTS[sport] : undefined;
  if (!row || !row.liveFeed || !live || !rootingSide) return false;
  if (live.status !== 'live' || live.period == null) return false;
  if (live.period < row.lateFrom) return false;
  const mine = rootingSide === 'home' ? live.homeScore : live.awayScore;
  const theirs = rootingSide === 'home' ? live.awayScore : live.homeScore;
  return mine < theirs;
}

/** Whether a live game is in its sport's signature break right now. */
export function isStretchTime(input: {
  sport: string | null | undefined;
  live: EggLive | null | undefined;
}): boolean {
  const { sport, live } = input;
  const row = sport ? EGG_SPORTS[sport] : undefined;
  if (!row || !row.liveFeed || !live) return false;
  if (live.status !== 'live' || live.period == null || !live.periodState) return false;
  return (
    row.signatureBreak.periods.includes(live.period) &&
    row.signatureBreak.states.includes(live.periodState)
  );
}

/** The server refreshes live state every minute. Older than this, a row says nothing of now. */
export const LIVE_FRESH_MS = 3 * 60 * 1000;

/** Whether a live row was fetched recently enough to act on. */
export function liveIsFresh(fetchedAt: string | null | undefined, now: number): boolean {
  if (!fetchedAt) return false;
  const at = Date.parse(fetchedAt);
  return Number.isFinite(at) && now - at <= LIVE_FRESH_MS;
}

/** An attendance, as far as finding the active check-in needs to know it. */
export type CheckInCandidate = {
  verified_via: string | null;
  rooting_team_id: string | null;
  game: {
    id: string;
    sport_id: string;
    status: string;
    scheduled_start: string;
    home_team_id: string;
    away_team_id: string;
  };
};

export type ActiveCheckIn = {
  gameId: string;
  sport: string;
  rootingTeamId: string | null;
  rootingSide: Side | null;
};

const HOUR = 60 * 60 * 1000;

/**
 * The game the person is at right now, or null.
 *
 * The app has no "current check-in" of its own. A check-in is an attendance verified by
 * `checkin`, so the active one is such an attendance whose game is not over. `games.status` can
 * lag behind the field, so "scheduled" counts and the live state says the rest; and a game that
 * never went final in the table stops counting six hours after its start, which is when the
 * server stops polling it too. There is no earlier bound: check-in itself only opens three
 * hours before the start.
 */
export function activeCheckIn(
  attendances: readonly CheckInCandidate[] | null | undefined,
  now: number,
): ActiveCheckIn | null {
  let best: CheckInCandidate | null = null;
  for (const a of attendances ?? []) {
    if (a.verified_via !== 'checkin') continue;
    if (a.game.status !== 'scheduled' && a.game.status !== 'live') continue;
    const start = Date.parse(a.game.scheduled_start);
    if (!Number.isFinite(start) || now > start + 6 * HOUR) continue;
    if (!best || a.game.scheduled_start > best.game.scheduled_start) best = a;
  }
  if (!best) return null;
  const side: Side | null =
    best.rooting_team_id === best.game.home_team_id
      ? 'home'
      : best.rooting_team_id === best.game.away_team_id
        ? 'away'
        : null;
  return {
    gameId: best.game.id,
    sport: best.game.sport_id,
    rootingTeamId: side ? best.rooting_team_id : null,
    rootingSide: side,
  };
}

/** A flipped cap, as the device remembers it. */
export type RallyCap = { teamId: string; at: number };

/** A cap nobody un-flipped is dropped after this long: no game runs twelve hours. */
export const RALLY_CAP_MAX_MS = 12 * HOUR;

/** Whether the wordmark is still upside down: the cap is on and its game is not over yet. */
export function rallyCapShowing(
  cap: RallyCap | null | undefined,
  gameStatus: string | null | undefined,
  now: number,
): boolean {
  if (!cap) return false;
  if (gameStatus != null && gameStatus !== 'scheduled' && gameStatus !== 'live') return false;
  return now - cap.at < RALLY_CAP_MAX_MS;
}

/** "Rally cap worked." is earned when the side the cap was flipped for won. Never for a loss. */
export function rallyCapWorked(
  cap: RallyCap | null | undefined,
  winnerTeamId: string | null | undefined,
): boolean {
  return !!cap && !!winnerTeamId && cap.teamId === winnerTeamId;
}
