/**
 * Canonical domain types shared by the app, ingestion, and Edge Functions.
 * Everything here is plain data; no provider-specific shapes leak past the adapters.
 */

export type Sport = 'mlb' | 'nfl' | 'nba' | 'mls';

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
  /** Stable identity distinct from the display year (MLS changes calendars in 2027). */
  seasonKey?: string;
  seasonLabel?: string;
  /** Penalties stay separate from goals; aggregate_shootout does not change the match winner. */
  decisionMethod?: 'regulation' | 'extra_time' | 'shootout' | 'aggregate_shootout' | null;
  homeShootoutScore?: number | null;
  awayShootoutScore?: number | null;
  winnerProviderTeamId?: string | null;
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
  /** Inning or quarter (5+ is overtime in NFL and NBA, 10+ extra innings in MLB). */
  period: number;
  half: 'top' | 'bottom' | null;
  /** Game clock for NFL and NBA (MM:SS remaining in the period), null for MLB. */
  clock: string | null;
  /** Score after this event. */
  homeScore: number;
  awayScore: number;
  /** Which side scored. */
  scoringSide: Side;
  description: string;
  /**
   * What the score was and who it belongs to (`scoring.ts`). Optional so a timeline built
   * before these existed still type-checks; the writer stores null for each when absent.
   */
  kind?: ScoringKind;
  scorerProviderId?: string | null;
  scorerName?: string | null;
}

/**
 * A closed vocabulary per sport for `game_scoring_timeline.kind`. Football first; then
 * baseball, where the kind is the batter's event when a run came home on it (a home run,
 * an RBI single, a sacrifice fly, a bases-loaded walk) or the thing the run came home on
 * when it did not (a wild pitch, a balk, a steal of home). `other` is anything else.
 */
export type NflScoringKind =
  'touchdown' | 'field_goal' | 'extra_point' | 'two_point' | 'safety' | 'other';
export type MlbScoringKind =
  | 'home_run'
  | 'single'
  | 'double'
  | 'triple'
  | 'sac_fly'
  | 'sac_bunt'
  | 'walk'
  | 'hit_by_pitch'
  | 'groundout'
  | 'flyout'
  | 'fielders_choice'
  | 'wild_pitch'
  | 'passed_ball'
  | 'balk'
  | 'steal'
  | 'error'
  | 'other';
/**
 * Basketball: every score names the scorer. `and_one` is a made free throw that followed the
 * same player's made basket (the foul came on the shot), so a list can fold it into the basket
 * the way an extra point folds into a touchdown. `dunk`, `layup` and `jumper` are two-point
 * baskets the feed described that way; `two` is any other two-pointer.
 */
export type NbaScoringKind =
  'three' | 'two' | 'dunk' | 'layup' | 'jumper' | 'free_throw' | 'and_one' | 'other';
export type ScoringKind = NflScoringKind | MlbScoringKind | NbaScoringKind;

export interface Appearance {
  providerPlayerId: string;
  fullName: string;
  providerTeamId: string;
}

/** One player on a team's current roster, as the provider lists them today. */
export interface RosterEntry {
  providerPlayerId: string;
  fullName: string;
  /** Provider position abbreviation (MLB `SS`, `P`; nflverse `QB`, `OL`), null when unknown. */
  position: string | null;
  /** Jersey number as text (providers leave it empty for some new arrivals). */
  jersey: string | null;
  /** Provider status code verbatim (MLB `A`, `D15`, `D60`; nflverse `ACT`, `RES`, `DEV`). */
  status: string | null;
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
  /**
   * When a run came home on something other than the plate appearance's result (a wild
   * pitch, a passed ball, a balk, a steal of home), that event and the runner, from the
   * feed's `runners[].details`. Null when the result itself scored the run, or when the
   * feed does not say. Optional because older fixtures and tests build plays without it.
   */
  runScoredOn?: RunScoredOn | null;
}

/** The non-batter event a run came home on, and who ran it in. */
export interface RunScoredOn {
  eventType: string;
  event: string;
  runnerId: string;
  runnerName: string;
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

/**
 * NBA play, derived from the CDN `liveData` play-by-play (2019-20 on, with wall-clock times)
 * or stats.nba.com `playbyplayv3` (back to 2000, no wall clock). One row per action the feed
 * lists: shots, free throws, rebounds, fouls, period markers.
 */
export interface NbaPlay {
  /** The feed's action number; ascending in game order. */
  actionNumber: number;
  /** 1-4, 5+ is overtime. */
  period: number;
  /** MM:SS remaining in the period, null when the feed had none. */
  clock: string | null;
  /** Seconds remaining in the period, to the tenth, null when unknown. */
  periodSecondsRemaining: number | null;
  /** Wall-clock time of the action in UTC; only the CDN feed has it. */
  timeActual: IsoTimestamp | null;
  /** The feed's actionType: '2pt', '3pt', 'freethrow', 'rebound', 'period', 'game', ... */
  actionType: string;
  subType: string | null;
  description: string;
  /** Score after the play. */
  homeScore: number;
  awayScore: number;
  isScoringPlay: boolean;
  /** Side of the team the action belongs to; null for period markers and jump balls. */
  side: Side | null;
  playerId: string | null;
  playerName: string | null;
  /** 2 or 3 on a made field goal, 1 on a made free throw, 0 otherwise. */
  points: number;
  isFieldGoal: boolean;
  shotMade: boolean | null;
  /** "1 of 2", "2 of 2", "1 of 1", "Technical" on a free throw; null otherwise. */
  freeThrowOf: string | null;
}

/** One player's box score line, for the moment detectors (triple-double, 50 points, 20 boards). */
export interface NbaBoxLine {
  playerId: string;
  playerName: string;
  side: Side;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
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
  plays:
    | { sport: 'mlb'; items: MlbPlay[] }
    | { sport: 'nfl'; items: NflPlay[] }
    | { sport: 'nba'; items: NbaPlay[] };
  /** Hits by side, for no-hitter and cycle detection (MLB). */
  hits?: { home: number; away: number } | undefined;
  /** Every player's line (NBA), for the box-score moments. */
  boxLines?: NbaBoxLine[] | undefined;
}

/**
 * Live state for the pledge lock (MLB and NBA). The column names are baseball's; the meaning
 * is a period and where the game stands in it.
 *
 *   MLB  `inning` is the inning, `inningState` is top, middle, bottom or end.
 *   NBA  `inning` is the period (5+ overtime), `inningState` is `live` while the clock runs,
 *        `end` between periods, `halftime` at the half, and `clock` is the game clock as the
 *        scoreboard shows it ("2:31"). The end of the first period is what locks a pick.
 */
export interface LiveState {
  status: GameStatus;
  inning: number | null;
  inningState: 'top' | 'middle' | 'bottom' | 'end' | 'live' | 'halftime' | null;
  /** Game clock remaining in the period (NBA), null for MLB. */
  clock?: string | null;
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
  | 'comeback_14'
  // NBA
  | 'buzzer_beater'
  | 'fifty_points'
  | 'triple_double'
  | 'quadruple_double'
  | 'twenty_rebounds'
  | 'twenty_assists'
  | 'comeback_20';

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
  /** The team's current roster. Absent for providers that publish rosters as season files. */
  fetchRoster?(providerTeamId: string): Promise<RosterEntry[]>;
}
