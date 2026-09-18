/** Shape of `user_stats_cache.payload` / `refresh_my_stats()` (SPEC.md 6.2, 6.8, 6.9). */

export type WinLossRecord = { wins: number; losses: number; ties: number };

export type StatsTotals = { games: number; venues: number; states: number; countries: number };

export type StatsTeam = {
  franchise_id: string;
  team_id: string;
  name: string;
  abbreviation: string;
  sport_id: string;
  record: WinLossRecord;
};

export type StatsPledge = { record: WinLossRecord; vs_expected: number };

export type StatsStamp = {
  venue_id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  visits: number;
  first_visit: string | null;
  sports: string[];
  closed: boolean;
  lat: number | null;
  lng: number | null;
};

export type GameRef = { game_id: string };

export type Superlatives = {
  coldest?: GameRef & { value: number };
  hottest?: GameRef & { value: number };
  longest?: GameRef & { minutes: number | null; periods: number | null };
  highest_scoring?: GameRef & { total: number };
  lowest_scoring?: GameRef & { total: number };
  /**
   * `low_win_prob` is the lowest chance (0 to 1) the user's side had in a game it won. It is only
   * there when the game has a win probability timeline, which means a Relive story. `sport_id`
   * words the deficit when it is not. Both arrived with superlatives v2, so both are optional.
   */
  biggest_comeback?: GameRef & { deficit: number; sport_id?: string; low_win_prob?: number };
  largest_crowd?: GameRef & { attendance: number };
  /** Only sent from 1,000 ft up. `game_id` is the most recent game there. */
  highest_altitude?: { venue_id: string; name: string; elevation_ft: number; game_id?: string };
  /** The favourite player seen most; ties go to the one favourited first. */
  most_seen_favorite_player?: { player_id: string; name: string; count: number };
  /** Still sent for builds already installed. Not shown: it is usually a stranger. */
  most_seen_player?: { player_id: string; name: string; count: number };
  most_seen_by_team?: {
    franchise_id: string;
    team_name: string;
    player_id: string;
    name: string;
    count: number;
  }[];
  most_visited_venue?: { venue_id: string; name: string; visits: number; game_id?: string };
  farthest_venue?: { venue_id: string; name: string; km: number; game_id?: string };
  most_miles_team?: { franchise_id: string; team_name: string; km: number };
  first_game?: GameRef & { date: string };
  /**
   * Famous games you were at (20260918000100_famous_games.sql). `count` is games, however many
   * reasons each is famous; `personal_count` is badges from your favourite players.
   */
  famous_games?: { count: number; personal_count: number };
};

export type StatsStreaks = { longest_win: number; longest_loss: number; current: number };

export type StatsMoment = { type: string; count: number };

export type StatsPayload = {
  totals: StatsTotals;
  overall: WinLossRecord;
  teams: StatsTeam[];
  pledge: StatsPledge;
  stamps: StatsStamp[];
  superlatives: Superlatives;
  streaks: StatsStreaks;
  moments: StatsMoment[];
  players_seen: number;
  computed_at: string | null;
};
