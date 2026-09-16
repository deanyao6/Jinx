/**
 * Streaming CSV reader for nflverse assets plus row mappers into the typed row shapes.
 *
 * nflverse CSVs (written by R) render nulls as empty cells and 0/1 flags as `0` / `1`. The reader
 * turns every empty cell into null; the mappers coerce the columns that the core row types expect
 * as numbers. Anything that is not a finite number becomes null rather than NaN.
 */
import type { NflverseGameRow, NflversePbpRow } from '@appname/core';
import { parse } from 'csv-parse';
import { pipeline, Readable } from 'node:stream';

/** One CSV record: header -> cell, with empty cells as null. */
export type RawRecord = Record<string, string | null>;

export async function* readCsv(source: Readable | string): AsyncGenerator<RawRecord> {
  const input = typeof source === 'string' ? Readable.from([source]) : source;
  const parser = parse({
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: false,
    cast: (value, context) => (context.header ? value : value === '' ? null : value),
  });
  // pipeline (not pipe) so an upstream error (truncated gzip, unreadable file) rejects the
  // iteration instead of surfacing as an unhandled 'error' event.
  pipeline(input, parser, () => undefined);
  for await (const record of parser) yield record as RawRecord;
}

export async function collectCsv(source: Readable | string): Promise<RawRecord[]> {
  const out: RawRecord[] = [];
  for await (const r of readCsv(source)) out.push(r);
  return out;
}

export function str(r: RawRecord, key: string): string | null {
  const v = r[key];
  return v == null || v === '' ? null : v;
}

export function num(r: RawRecord, key: string): number | null {
  const v = r[key];
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function reqStr(r: RawRecord, key: string): string {
  const v = str(r, key);
  if (v == null) throw new Error(`csv: required column ${key} is empty`);
  return v;
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * nflverse `time_of_day` is an ISO 8601 UTC string from 2005 on, but a bare `HH:MM:SS` clock with
 * no date or timezone in 2001-2004 and empty in 2000. Only full timestamps are usable; anything
 * else becomes null (which marks the game's timeline unreliable, as intended).
 */
export function isoTimestampOrNull(value: string | null): string | null {
  return value != null && ISO_TIMESTAMP.test(value) ? value : null;
}

export function reqNum(r: RawRecord, key: string): number {
  const v = num(r, key);
  if (v == null) throw new Error(`csv: required numeric column ${key} is empty`);
  return v;
}

/** games.csv -> NflverseGameRow. */
export function toGameRow(r: RawRecord): NflverseGameRow {
  return {
    game_id: reqStr(r, 'game_id'),
    season: reqNum(r, 'season'),
    game_type: reqStr(r, 'game_type'),
    week: num(r, 'week'),
    gameday: reqStr(r, 'gameday'),
    weekday: str(r, 'weekday'),
    gametime: str(r, 'gametime'),
    away_team: reqStr(r, 'away_team'),
    away_score: num(r, 'away_score'),
    home_team: reqStr(r, 'home_team'),
    home_score: num(r, 'home_score'),
    location: str(r, 'location'),
    result: num(r, 'result'),
    total: num(r, 'total'),
    overtime: num(r, 'overtime'),
    old_game_id: str(r, 'old_game_id'),
    gsis: num(r, 'gsis'),
    espn: num(r, 'espn'),
    pfr: str(r, 'pfr'),
    roof: str(r, 'roof'),
    surface: str(r, 'surface'),
    temp: num(r, 'temp'),
    wind: num(r, 'wind'),
    stadium_id: str(r, 'stadium_id'),
    stadium: str(r, 'stadium'),
  };
}

/** play_by_play_{season}.csv -> NflversePbpRow (only the columns the parser depends on). */
export function toPbpRow(r: RawRecord): NflversePbpRow {
  return {
    game_id: reqStr(r, 'game_id'),
    play_id: num(r, 'play_id'),
    order_sequence: num(r, 'order_sequence'),
    qtr: num(r, 'qtr'),
    time: str(r, 'time'),
    quarter_seconds_remaining: num(r, 'quarter_seconds_remaining'),
    game_seconds_remaining: num(r, 'game_seconds_remaining'),
    game_half: str(r, 'game_half'),
    time_of_day: isoTimestampOrNull(str(r, 'time_of_day')),
    start_time: str(r, 'start_time'),
    desc: str(r, 'desc'),
    sp: num(r, 'sp'),
    play_type: str(r, 'play_type'),
    total_home_score: num(r, 'total_home_score'),
    total_away_score: num(r, 'total_away_score'),
    td_team: str(r, 'td_team'),
    touchdown: num(r, 'touchdown'),
    pass_touchdown: num(r, 'pass_touchdown'),
    rush_touchdown: num(r, 'rush_touchdown'),
    return_touchdown: num(r, 'return_touchdown'),
    return_team: str(r, 'return_team'),
    interception: num(r, 'interception'),
    fumble: num(r, 'fumble'),
    fumble_lost: num(r, 'fumble_lost'),
    safety: num(r, 'safety'),
    field_goal_result: str(r, 'field_goal_result'),
    kick_distance: num(r, 'kick_distance'),
    punt_attempt: num(r, 'punt_attempt'),
    kickoff_attempt: num(r, 'kickoff_attempt'),
    extra_point_attempt: num(r, 'extra_point_attempt'),
    two_point_attempt: num(r, 'two_point_attempt'),
    home_team: reqStr(r, 'home_team'),
    away_team: reqStr(r, 'away_team'),
    home_score: num(r, 'home_score'),
    away_score: num(r, 'away_score'),
    result: num(r, 'result'),
    season_type: str(r, 'season_type'),
    week: num(r, 'week'),
    game_date: str(r, 'game_date'),
    stadium: str(r, 'stadium'),
    weather: str(r, 'weather'),
    temp: num(r, 'temp'),
    roof: str(r, 'roof'),
    posteam: str(r, 'posteam'),
    defteam: str(r, 'defteam'),
  };
}

/** snap_counts_{season}.csv (2012+). */
export interface SnapCountRow {
  game_id: string;
  season: number | null;
  week: number | null;
  player: string | null;
  pfr_player_id: string | null;
  position: string | null;
  team: string | null;
  opponent: string | null;
  offense_snaps: number | null;
  defense_snaps: number | null;
  st_snaps: number | null;
}

export function toSnapCountRow(r: RawRecord): SnapCountRow {
  return {
    game_id: reqStr(r, 'game_id'),
    season: num(r, 'season'),
    week: num(r, 'week'),
    player: str(r, 'player'),
    pfr_player_id: str(r, 'pfr_player_id'),
    position: str(r, 'position'),
    team: str(r, 'team'),
    opponent: str(r, 'opponent'),
    offense_snaps: num(r, 'offense_snaps'),
    defense_snaps: num(r, 'defense_snaps'),
    st_snaps: num(r, 'st_snaps'),
  };
}

/** players.csv: the id crosswalk columns only. */
export interface PlayerIdRow {
  gsis_id: string | null;
  pfr_id: string | null;
  display_name: string | null;
  position: string | null;
}

export function toPlayerIdRow(r: RawRecord): PlayerIdRow {
  return {
    gsis_id: str(r, 'gsis_id'),
    pfr_id: str(r, 'pfr_id'),
    display_name: str(r, 'display_name'),
    position: str(r, 'position'),
  };
}

/** stats_player_week_{season}.csv (fallback appearances for 2000-2011). */
export interface StatsWeekRow {
  /** gsis id */
  player_id: string | null;
  player_display_name: string | null;
  player_name: string | null;
  season: number | null;
  week: number | null;
  season_type: string | null;
  game_id: string | null;
  /** Current-franchise abbreviation (nflverse writes LV for the 2005 Raiders). */
  team: string | null;
  opponent_team: string | null;
}

export function toStatsWeekRow(r: RawRecord): StatsWeekRow {
  return {
    player_id: str(r, 'player_id'),
    player_display_name: str(r, 'player_display_name'),
    player_name: str(r, 'player_name'),
    season: num(r, 'season'),
    week: num(r, 'week'),
    season_type: str(r, 'season_type'),
    game_id: str(r, 'game_id'),
    team: str(r, 'team') ?? str(r, 'recent_team'),
    opponent_team: str(r, 'opponent_team'),
  };
}
