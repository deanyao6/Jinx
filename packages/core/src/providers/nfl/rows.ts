/**
 * Raw nflverse row shapes as they arrive from games.csv and play_by_play_{season}.parquet
 * (column names and semantics verified in docs/verification.md). Everything is nullable:
 * parquet nulls become null, empty CSV cells become null, and 0/1 flags arrive as numbers.
 */

/** One row of the nflverse `games.csv` schedule release. */
export interface NflverseGameRow {
  game_id: string;
  season: number;
  /** REG, WC, DIV, CON, SB (no preseason in nflverse). */
  game_type: string;
  week: number | null;
  /** YYYY-MM-DD */
  gameday: string;
  weekday?: string | null;
  /** HH:MM Eastern; may be empty for old seasons. */
  gametime: string | null;
  away_team: string;
  away_score: number | null;
  home_team: string;
  home_score: number | null;
  /** 'Home' | 'Neutral' */
  location: string | null;
  /** home minus away */
  result?: number | null;
  total?: number | null;
  overtime?: number | null;
  old_game_id?: string | null;
  gsis?: number | null;
  espn?: number | null;
  pfr?: string | null;
  /** outdoors | dome | closed | open */
  roof?: string | null;
  surface?: string | null;
  /** Fahrenheit, empty for domes. */
  temp: number | null;
  wind?: number | null;
  stadium_id: string | null;
  stadium: string | null;
}

/** The subset of nflverse play-by-play columns the parser and detectors depend on. */
export interface NflversePbpRow {
  game_id: string;
  play_id: number | null;
  order_sequence: number | null;
  /** 1..4, 5 = overtime. */
  qtr: number | null;
  /** Game clock MM:SS remaining in the quarter. */
  time: string | null;
  quarter_seconds_remaining: number | null;
  game_seconds_remaining: number | null;
  game_half?: string | null;
  /** ISO 8601 UTC string with Z; null on marker rows. */
  time_of_day: string | null;
  start_time?: string | null;
  desc: string | null;
  /** 1 = scoring play. */
  sp: number | null;
  play_type: string | null;
  /** Score after the play. */
  total_home_score: number | null;
  total_away_score: number | null;
  td_team: string | null;
  touchdown: number | null;
  pass_touchdown?: number | null;
  rush_touchdown?: number | null;
  return_touchdown: number | null;
  return_team?: string | null;
  interception: number | null;
  fumble: number | null;
  fumble_lost?: number | null;
  safety: number | null;
  /** made | missed | blocked */
  field_goal_result: string | null;
  kick_distance: number | null;
  punt_attempt: number | null;
  kickoff_attempt: number | null;
  extra_point_attempt: number | null;
  two_point_attempt: number | null;
  home_team: string;
  away_team: string;
  /** Final score, repeated on every row. */
  home_score?: number | null;
  away_score?: number | null;
  result?: number | null;
  season_type?: string | null;
  week?: number | null;
  game_date?: string | null;
  stadium?: string | null;
  weather?: string | null;
  temp?: number | null;
  roof?: string | null;
  /** Team in possession (receiving team on kickoffs, kicking team on punts). */
  posteam: string | null;
  defteam?: string | null;
}
