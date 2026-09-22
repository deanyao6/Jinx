/**
 * NFL honors into player_honors, from the hand-kept seed/nfl_awards.json.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/nfl/honors.ts
 *
 * No free structured source carries NFL awards: nflverse has no awards release and its
 * players, rosters and pfr_rosters files carry no Pro Bowl or All-Pro flag (checked
 * 2026-09-17, docs/verification.md). So the file is kept by hand from public record: MVP, the
 * rest of the MVP top five, and AP first-team All-Pro. Not the Pro Bowl: Dean, 2026-09-18,
 * "only all pro teams". Each row names the player by gsis id, the same id game_appearances
 * uses. The file's rows replace what the last run loaded, so deleting a line removes the honor.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { upsertRows } from '@jinx/core';

import { createDb } from '../db.js';
import { ensurePlayers, refreshAllStats } from '../famous/players.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const NFL_AWARDS_FILE = path.join(ROOT, 'seed', 'nfl_awards.json');
export const NFL_HONORS: ReadonlySet<string> = new Set(['mvp', 'mvp_top5', 'all_pro_1st']);

export interface NflAwardRow {
  season: number;
  honor: string;
  gsis_id: string;
  name: string;
  source?: string;
}

/** Shape checks: a bad row stops the run rather than loading half a file. */
export function validateNflAwards(rows: readonly NflAwardRow[]): string[] {
  const problems: string[] = [];
  rows.forEach((r, i) => {
    if (!Number.isInteger(r.season)) problems.push(`row ${i + 1}: season must be a year`);
    if (!NFL_HONORS.has(r.honor))
      problems.push(`row ${i + 1}: honor must be one of ${[...NFL_HONORS].join(', ')}`);
    if (!/^\d{2}-\d{7}$/.test(r.gsis_id ?? ''))
      problems.push(`row ${i + 1}: gsis_id looks like 00-0034857`);
    if (!r.name) problems.push(`row ${i + 1}: name is required`);
  });
  return problems;
}

async function main(): Promise<void> {
  const rows = JSON.parse(readFileSync(NFL_AWARDS_FILE, 'utf8')) as NflAwardRow[];
  const problems = validateNflAwards(rows);
  if (problems.length > 0) throw new Error(`seed/nfl_awards.json:\n  ${problems.join('\n  ')}`);
  const db = createDb();
  const ids = await ensurePlayers(
    db,
    'nfl',
    'nflverse',
    rows.map((r) => ({ providerPlayerId: r.gsis_id, fullName: r.name })),
  );
  const out = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const playerId = ids.get(r.gsis_id)!;
    out.set(`${playerId}:${r.season}:${r.honor}`, {
      player_id: playerId,
      season: r.season,
      honor: r.honor,
      source: 'seed/nfl_awards.json',
    });
  }
  const { error } = await db.from('player_honors').delete().eq('source', 'seed/nfl_awards.json');
  if (error) throw new Error(`clear NFL honors: ${error.message}`);
  await upsertRows(db, 'player_honors', [...out.values()], 'player_id,season,honor');
  console.log(`${out.size} NFL honor rows`);
  await refreshAllStats(db);
}

const isEntrypoint = process.argv[1] != null && /[\\/]nfl[\\/]honors\.ts$/.test(process.argv[1]);
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
