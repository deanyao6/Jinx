/**
 * Canonical domain types shared by the app, ingestion, and Edge Functions.
 * Everything here is plain data; no provider-specific shapes leak past the adapters.
 */

export type Sport = 'mlb' | 'nfl';

export type GameStatus = 'scheduled' | 'live' | 'final' | 'postponed' | 'suspended' | 'cancelled';

export type GameType = 'regular' | 'postseason' | 'preseason';

export type Side = 'home' | 'away';

/** ISO 8601 timestamp string in UTC. */
export type IsoTimestamp = string;

export interface DateRange {
  /** inclusive, YYYY-MM-DD */
  start: string;
  /** inclusive, YYYY-MM-DD */
  end: string;
}

export interface CanonicalTeam {
  provider: string;
  providerTeamId: string;
  /** Stable across relocations and renames (e.g. MLB team id, NFL franchise slug). */
  franchiseId: string;
  sport: Sport;
  name: string;
  city: string;
  abbreviation: string;
  active: boolean;
  primaryColorHex?: string | undefined;
  aliases: string[];
}

export interface CanonicalVenue {
  key: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  lat: number;
  lng: number;
  geofenceM: number;
  openedYear: number | null;
  closedYear: number | null;
  sports: Sport[];
  aliases: string[];
  providerIds: Record<string, string | string[] | number>;
}

export interface CanonicalGame {
  provider: string;
  providerGameId: string;
  sport: Sport;
  season: number;
  gameType: GameType;
  scheduledStart: IsoTimestamp;
  providerVenueId: string | null;
  venueName: string | null;
  homeProviderTeamId: string;
  awayProviderTeamId: string;
  status: GameStatus;
  homeScore: number | null;
  awayScore: number | null;
  isTie: boolean;
  /** 1 or 2 for doubleheaders, null otherwise. */
  doubleheaderNumber: number | null;
  /** Provider id of the postponed game this one makes up, if any. */
  rescheduledFromProviderGameId: string | null;
  /** Provider id of the makeup game, set on the postponed row when known. */
  rescheduledToProviderGameId: string | null;
  isNeutralSite: boolean;
  /** Set when the provider reports a completed game. */
  finalAt: IsoTimestamp | null;
}

/** One row of the scoring timeline (score changes only). */
export interface ScoringEvent {
  seq: number;
  occurredAt: IsoTimestamp | null;
  /** Inning or quarter (5+ is overtime in NFL, 10+ extra innings in MLB). */
  period: number;
  half: 'top' | 'bottom' | null;
  /** Game clock for NFL (MM:SS remaining), null for MLB. */
  clock: string | null;
  /** Score after this event. */
  homeScore: number;
  awayScore: number;
  /** Which side scored. */
  scoringSide: Side;
  description: string;
}

export interface Appearance {
  providerPlayerId: string;
  fullName: string;
  providerTeamId: string;
}

/** MLB plate appearance, derived from liveData.plays.allPlays. */
export interface MlbPlay {
  index: number;
  inning: number;
  half: 'top' | 'bottom';
  startTime: IsoTimestamp | null;
  endTime: IsoTimestamp | null;
  /** MLB eventType code, e.g. 'home_run', 'single', 'strikeout', 'field_out'. */
  eventType: string;
  event: string;
  description: string;
  rbi: number;
  /** Score after the play. */
  homeScore: number;
  awayScore: number;
  isScoringPlay: boolean;
  isOut: boolean;
  /** Outs after the play completed. */
  outsAfter: number;
  batterId: string;
  batterName: string;
  pitcherId: string;
  pitcherName: string;
  /** Batting side: 'away' in the top half, 'home' in the bottom half. */
  battingSide: Side;
  /** Number of pitches thrown in this plate appearance. */
  pitchCount: number;
  /** True when the plate appearance ended with a strikeout on exactly three strikes and every pitch was a strike (for immaculate innings). */
  allStrikes: boolean;
  /** Number of runners on base when the play started (0-3). */
  runnersOnStart: number;
}

/** NFL play, derived from nflverse play-by-play. */
export interface NflPlay {
  order: number;
  playId: string;
  /** 1-4, 5+ is overtime. */
  qtr: number;
  /** Game clock at the start of the play, MM:SS remaining in the quarter. */
  clock: string | null;
  quarterSecondsRemaining: number | null;
  gameSecondsRemaining: number | null;
  timeOfDay: IsoTimestamp | null;
  description: string;
  isScoringPlay: boolean;
  playType: string | null;
  /** Score after the play. */
  homeScore: number;
  awayScore: number;
  /** Side of the team in possession, null for special rows. */
  posSide: Side | null;
  /** Side that scored a touchdown on this play, if any. */
  tdSide: Side | null;
  /**
   * Who put the points on the board: the touchdown scorer, or the kicker on a field goal.
   * `providerPlayerId` is the gsis id, which is what `game_appearances` is keyed by, so a
   * moment resolves to the same `players` row the lineup does.
   *
   * Null on any play that has no single scorer — a safety, a marker row, a defensive stop.
   */
  scorerProviderId: string | null;
  scorerName: string | null;
  touchdown: boolean;
  returnTouchdown: boolean;
  interception: boolean;
  fumble: boolean;
  safety: boolean;
  fieldGoalResult: 'made' | 'missed' | 'blocked' | null;
  kickDistance: number | null;
  kickoffAttempt: boolean;
  puntAttempt: boolean;
  extraPointAttempt: boolean;
  twoPointAttempt: boolean;
}

export interface CanonicalGameDetail extends CanonicalGame {
  temperatureF: number | null;
  durationMinutes: number | null;
  attendance: number | null;
  /** Innings played (MLB) or periods including OT (NFL). */
  inningsOrPeriods: number | null;
  appearances: Appearance[];
  timeline: ScoringEvent[];
  /** True when every scoring event and first-inning/first-quarter play carries a wall-clock timestamp. */
  timestampsReliable: boolean;
  plays: { sport: 'mlb'; items: MlbPlay[] } | { sport: 'nfl'; items: NflPlay[] };
  /** Hits by side, for no-hitter and cycle detection (MLB). */
  hits?: { home: number; away: number } | undefined;
}

/** Live state for the pledge lock (MLB only in v1). */
export interface LiveState {
  status: GameStatus;
  inning: number | null;
  /** 'top' | 'middle' | 'bottom' | 'end' */
  inningState: 'top' | 'middle' | 'bottom' | 'end' | null;
  homeScore: number;
  awayScore: number;
  fetchedAt: IsoTimestamp;
}

export type MomentType =
  // MLB
  | 'walk_off'
  | 'walk_off_home_run'
  | 'grand_slam'
  | 'cycle'
  | 'no_hitter'
  | 'perfect_game'
  | 'extra_innings'
  | 'shutout'
  | 'immaculate_inning'
  | 'home_run'
  // NFL
  | 'overtime'
  | 'late_go_ahead_score'
  | 'walk_off_score'
  | 'pick_six'
  | 'fumble_return_td'
  | 'kick_return_td'
  | 'safety'
  | 'long_field_goal'
  | 'comeback_14';

export interface GameEvent {
  type: MomentType;
  /** Side credited with the moment, null for game-level moments like extra innings. */
  side: Side | null;
  providerPlayerId: string | null;
  playerName: string | null;
  occurredAt: IsoTimestamp | null;
  detail: Record<string, unknown>;
}

export interface SportsDataProvider {
  sport: Sport;
  fetchTeams(): Promise<CanonicalTeam[]>;
  fetchSchedule(range: DateRange): Promise<CanonicalGame[]>;
  fetchGameDetail(providerGameId: string): Promise<CanonicalGameDetail>;
  fetchLiveState?(providerGameId: string): Promise<LiveState>;
}
