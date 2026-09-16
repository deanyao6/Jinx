/** Shared fixture loading for the NFL parser and moment tests (not a test file itself). */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CanonicalGameDetail, NflPlay } from '../../types.js';
import { parseNflGame } from './parse.js';
import type { NflverseGameRow, NflversePbpRow } from './rows.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE_DIR = path.resolve(here, '../../../../../ingest/fixtures/nfl');

export const FIXTURE_GAME_IDS = [
  '2024_12_TEN_HOU',
  '2024_04_NO_ATL',
  '2024_05_BAL_CIN',
  '2024_10_DET_HOU',
  '2024_06_TB_NO',
] as const;

export type FixtureGameId = (typeof FIXTURE_GAME_IDS)[number];

export function loadGameRows(): NflverseGameRow[] {
  const raw = readFileSync(path.join(FIXTURE_DIR, 'games_2024_sample.json'), 'utf8');
  return JSON.parse(raw) as NflverseGameRow[];
}

export function loadGameRow(gameId: FixtureGameId): NflverseGameRow {
  const row = loadGameRows().find((g) => g.game_id === gameId);
  if (!row) throw new Error(`missing games.csv fixture row for ${gameId}`);
  return row;
}

export function loadPbpRows(gameId: FixtureGameId): NflversePbpRow[] {
  const raw = readFileSync(path.join(FIXTURE_DIR, `pbp_${gameId}.json`), 'utf8');
  return JSON.parse(raw) as NflversePbpRow[];
}

export function loadDetail(gameId: FixtureGameId): CanonicalGameDetail {
  return parseNflGame(loadGameRow(gameId), loadPbpRows(gameId));
}

/** Narrow a detail's plays to NFL plays (throws if the detail is not NFL). */
export function nflPlays(detail: CanonicalGameDetail): NflPlay[] {
  if (detail.plays.sport !== 'nfl') throw new Error('expected NFL plays');
  return detail.plays.items;
}
