/**
 * Player appearances per nflverse game_id (SPEC 4.3: "appeared" = at least one offensive,
 * defensive or special-teams snap, or a stat line).
 *
 * - 2012+: snap_counts_{season} rows with any snap count > 0. The player key there is the PFR id,
 *   mapped to the gsis id through players.csv (pfr_id -> gsis_id). Rows whose PFR id has no gsis
 *   id are skipped and counted.
 * - 2000-2011: stats_player_week_{season} rows (keyed by gsis id). Each row carries a game_id;
 *   when it is missing, the game is resolved by (season, week, team) against games.csv.
 *
 * nflverse writes the *current* franchise abbreviation in the stats/roster releases (LV for the
 * 2005 Raiders), while games.csv keeps the historical one (OAK). Team resolution therefore goes
 * through the game's home/away pair plus RELOCATED_ALIASES, using the opponent column when the
 * team column alone is ambiguous.
 */
import type { Appearance, BoxLine, NflverseGameRow } from '@jinx/core';

import type { PlayerIdRow, SnapCountRow, StatsWeekRow } from './csv.js';

/** Current abbreviation -> historical abbreviations that appear in games.csv (2000+). */
export const RELOCATED_ALIASES: Readonly<Record<string, readonly string[]>> = {
  LV: ['OAK'],
  LA: ['STL'],
  LAC: ['SD'],
};

export interface PlayerIdentity {
  gsisId: string;
  name: string;
}

export interface AppearanceIndex {
  byGame: Map<string, Appearance[]>;
  skipped: {
    /** Snap-count rows whose PFR id had no gsis id in players.csv. */
    missingGsis: number;
    /** Rows whose game could not be resolved. */
    unknownGame: number;
    /** Rows whose team matched neither side of the game. */
    unknownTeam: number;
    /** Rows with no player id at all. */
    missingPlayer: number;
  };
}

function emptyIndex(): AppearanceIndex {
  return {
    byGame: new Map(),
    skipped: { missingGsis: 0, unknownGame: 0, unknownTeam: 0, missingPlayer: 0 },
  };
}

/** players.csv -> pfr_id -> { gsisId, name }. Rows without both ids are ignored. */
export function buildPfrToGsis(rows: Iterable<PlayerIdRow>): Map<string, PlayerIdentity> {
  const out = new Map<string, PlayerIdentity>();
  for (const r of rows) {
    if (r.pfr_id == null || r.gsis_id == null) continue;
    out.set(r.pfr_id, { gsisId: r.gsis_id, name: r.display_name ?? r.gsis_id });
  }
  return out;
}

export interface GameTeams {
  home: string;
  away: string;
}

/** Candidate historical abbreviations for a (possibly modern) team code. */
export function teamCandidates(team: string): string[] {
  return [team, ...(RELOCATED_ALIASES[team] ?? [])];
}

/**
 * Picks the game-side abbreviation for a row's team. Falls back to "the other side" when only
 * the opponent resolves (e.g. `team` is LV in a 2005 OAK game).
 */
export function resolveTeam(
  game: GameTeams,
  team: string | null,
  opponent: string | null,
): string | null {
  if (team != null) {
    const direct = teamCandidates(team).find((t) => t === game.home || t === game.away);
    if (direct != null) return direct;
  }
  if (opponent != null) {
    const opp = teamCandidates(opponent).find((t) => t === game.home || t === game.away);
    if (opp != null) return opp === game.home ? game.away : game.home;
  }
  return null;
}

export interface ScheduleIndex {
  teamsByGameId: Map<string, GameTeams>;
  /** `${season}:${week}:${team}` -> game_id, for every historical abbreviation and alias. */
  gameIdBySeasonWeekTeam: Map<string, string>;
}

export function buildScheduleIndex(games: Iterable<NflverseGameRow>): ScheduleIndex {
  const teamsByGameId = new Map<string, GameTeams>();
  const gameIdBySeasonWeekTeam = new Map<string, string>();
  const modernFor = new Map<string, string[]>();
  for (const [modern, olds] of Object.entries(RELOCATED_ALIASES)) {
    for (const old of olds) modernFor.set(old, [...(modernFor.get(old) ?? []), modern]);
  }
  for (const g of games) {
    teamsByGameId.set(g.game_id, { home: g.home_team, away: g.away_team });
    if (g.week == null) continue;
    for (const team of [g.home_team, g.away_team]) {
      for (const code of [team, ...(modernFor.get(team) ?? [])]) {
        gameIdBySeasonWeekTeam.set(`${g.season}:${g.week}:${code}`, g.game_id);
      }
    }
  }
  return { teamsByGameId, gameIdBySeasonWeekTeam };
}

export function resolveGameId(
  index: ScheduleIndex,
  season: number | null,
  week: number | null,
  team: string | null,
): string | null {
  if (season == null || week == null || team == null) return null;
  return index.gameIdBySeasonWeekTeam.get(`${season}:${week}:${team}`) ?? null;
}

function addAppearance(
  index: AppearanceIndex,
  seen: Set<string>,
  gameId: string,
  appearance: Appearance,
): void {
  const key = `${gameId}\u0000${appearance.providerPlayerId}`;
  if (seen.has(key)) return;
  seen.add(key);
  const list = index.byGame.get(gameId);
  if (list) list.push(appearance);
  else index.byGame.set(gameId, [appearance]);
}

export function hasSnap(row: SnapCountRow): boolean {
  return (row.offense_snaps ?? 0) > 0 || (row.defense_snaps ?? 0) > 0 || (row.st_snaps ?? 0) > 0;
}

/** 2012+: snap counts joined to players.csv for the gsis id. */
export function appearancesFromSnapCounts(
  rows: Iterable<SnapCountRow>,
  pfrToGsis: Map<string, PlayerIdentity>,
  schedule: ScheduleIndex,
): AppearanceIndex {
  const index = emptyIndex();
  const seen = new Set<string>();
  for (const row of rows) {
    if (!hasSnap(row)) continue;
    if (row.pfr_player_id == null) {
      index.skipped.missingPlayer++;
      continue;
    }
    const player = pfrToGsis.get(row.pfr_player_id);
    if (!player) {
      index.skipped.missingGsis++;
      continue;
    }
    const game = schedule.teamsByGameId.get(row.game_id);
    if (!game) {
      index.skipped.unknownGame++;
      continue;
    }
    const team = resolveTeam(game, row.team, row.opponent);
    if (team == null) {
      index.skipped.unknownTeam++;
      continue;
    }
    addAppearance(index, seen, row.game_id, {
      providerPlayerId: player.gsisId,
      fullName: row.player ?? player.name,
      providerTeamId: team,
    });
  }
  return index;
}

/** 2000-2011 fallback: a weekly stat line is an appearance. */
export function appearancesFromWeeklyStats(
  rows: Iterable<StatsWeekRow>,
  schedule: ScheduleIndex,
): AppearanceIndex {
  const index = emptyIndex();
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.player_id == null) {
      index.skipped.missingPlayer++;
      continue;
    }
    let gameId: string | null =
      row.game_id != null && schedule.teamsByGameId.has(row.game_id) ? row.game_id : null;
    if (gameId == null) gameId = resolveGameId(schedule, row.season, row.week, row.team);
    const game = gameId != null ? schedule.teamsByGameId.get(gameId) : undefined;
    if (gameId == null || !game) {
      index.skipped.unknownGame++;
      continue;
    }
    const team = resolveTeam(game, row.team, row.opponent_team);
    if (team == null) {
      index.skipped.unknownTeam++;
      continue;
    }
    addAppearance(index, seen, gameId, {
      providerPlayerId: row.player_id,
      fullName: row.player_display_name ?? row.player_name ?? row.player_id,
      providerTeamId: team,
    });
  }
  return index;
}

/**
 * The box-score line of every player in every game of a season, from the weekly stats file:
 * touchdowns reached (rushing, receiving, returns, defensive, fumble recoveries; never a kick),
 * yards by kind, sacks and interceptions. Keyed by game id, then gsis id. Games the schedule
 * cannot place are skipped, as in appearancesFromWeeklyStats.
 */
export function linesFromWeeklyStats(
  rows: Iterable<StatsWeekRow>,
  schedule: ScheduleIndex,
): Map<string, Map<string, BoxLine>> {
  const out = new Map<string, Map<string, BoxLine>>();
  for (const row of rows) {
    if (row.player_id == null) continue;
    let gameId: string | null =
      row.game_id != null && schedule.teamsByGameId.has(row.game_id) ? row.game_id : null;
    if (gameId == null) gameId = resolveGameId(schedule, row.season, row.week, row.team);
    if (gameId == null) continue;
    let byPlayer = out.get(gameId);
    if (!byPlayer) out.set(gameId, (byPlayer = new Map()));
    byPlayer.set(row.player_id, {
      td:
        (row.rushing_tds ?? 0) +
        (row.receiving_tds ?? 0) +
        (row.special_teams_tds ?? 0) +
        (row.def_tds ?? 0) +
        (row.fumble_recovery_tds ?? 0),
      rush_yds: row.rushing_yards ?? 0,
      rec_yds: row.receiving_yards ?? 0,
      pass_yds: row.passing_yards ?? 0,
      sacks: row.def_sacks ?? 0,
      int: row.def_interceptions ?? 0,
    });
  }
  return out;
}

/** Attaches the lines to a game's appearances; a player with no stat line keeps none. */
export function withLines(
  appearances: Appearance[],
  lines: Map<string, BoxLine> | undefined,
): Appearance[] {
  if (!lines) return appearances;
  return appearances.map((a) => ({ ...a, line: lines.get(a.providerPlayerId) ?? null }));
}

export function countAppearances(index: AppearanceIndex): number {
  let n = 0;
  for (const list of index.byGame.values()) n += list.length;
  return n;
}
