/**
 * nflverse games.csv -> canonical schedule rows, upserted per season.
 *
 * finalAt: nflverse has no "game ended" wall clock at the schedule level, so for games with a
 * score we approximate scheduledStart (gameday + gametime, Eastern -> UTC) + 4 hours. The detail
 * pass (run.ts) replaces that with the last play's `time_of_day` when pbp has one, and the
 * schedule pass keeps that better value on later runs instead of overwriting it.
 */
import { NFL_PROVIDER, parseNflGame, type CanonicalGame, type NflverseGameRow } from '@jinx/core';
import type { Readable } from 'node:stream';

import { selectAll, setProgress, type Db } from '../db.js';
import { upsertGames, type GameWriteContext } from '../games.js';
import { readCsv, toGameRow } from './csv.js';

export const SCHEDULE_JOB = 'nfl_schedule';

/** Approximate game length used for finalAt when no play-by-play wall clock is available. */
export const APPROX_GAME_HOURS = 4;

export async function loadScheduleRows(source: Readable | string): Promise<NflverseGameRow[]> {
  const rows: NflverseGameRow[] = [];
  for await (const r of readCsv(source)) rows.push(toGameRow(r));
  return rows;
}

export function approxFinalAt(scheduledStart: string): string {
  return new Date(Date.parse(scheduledStart) + APPROX_GAME_HOURS * 3600_000).toISOString();
}

/**
 * Schedule-level canonical game (no plays). finalAt is only set when a score is present: the
 * value the detail pass already stored (last play wall clock) when there is one, else the
 * approximation.
 */
export function scheduleGame(row: NflverseGameRow, existingFinalAt?: string | null): CanonicalGame {
  const game: CanonicalGame = parseNflGame(row, []);
  if (game.status !== 'final') return { ...game, finalAt: null };
  return { ...game, finalAt: existingFinalAt ?? approxFinalAt(game.scheduledStart) };
}

/** provider_game_id -> final_at for nflverse games the detail pass has already written. */
export async function loadDetailFinalAt(db: Db): Promise<Map<string, string>> {
  const rows = await selectAll<{ provider_game_id: string; final_at: string | null }>(
    db,
    'games',
    'provider_game_id, final_at',
    (q) => q.eq('provider', NFL_PROVIDER).not('detail_ingested_at', 'is', null),
  );
  const out = new Map<string, string>();
  for (const r of rows) if (r.final_at != null) out.set(r.provider_game_id, r.final_at);
  return out;
}

export function groupBySeason(rows: NflverseGameRow[]): Map<number, NflverseGameRow[]> {
  const out = new Map<number, NflverseGameRow[]>();
  for (const r of rows) {
    const list = out.get(r.season);
    if (list) list.push(r);
    else out.set(r.season, [r]);
  }
  return out;
}

export interface SeasonScheduleSummary {
  season: number;
  games: number;
  finals: number;
}

/** Upserts every season >= from (and <= to when given), recording nfl_schedule progress per season. */
export async function upsertAllSeasons(
  db: Db,
  ctx: GameWriteContext,
  rows: NflverseGameRow[],
  range: { from: number; to?: number },
): Promise<SeasonScheduleSummary[]> {
  const out: SeasonScheduleSummary[] = [];
  const existingFinalAt = await loadDetailFinalAt(db);
  const seasons = [...groupBySeason(rows).entries()]
    .filter(([season]) => season >= range.from && (range.to == null || season <= range.to))
    .sort((a, b) => a[0] - b[0]);
  for (const [season, seasonRows] of seasons) {
    const key = String(season);
    await setProgress(db, SCHEDULE_JOB, key, 'running');
    try {
      const games = seasonRows.map((r) => scheduleGame(r, existingFinalAt.get(r.game_id) ?? null));
      await upsertGames(db, games, ctx);
      const finals = games.filter((g) => g.status === 'final').length;
      await setProgress(db, SCHEDULE_JOB, key, 'done', { games: games.length, finals });
      out.push({ season, games: games.length, finals });
    } catch (err) {
      await setProgress(db, SCHEDULE_JOB, key, 'failed', { error: String(err) });
      throw err;
    }
  }
  return out;
}
