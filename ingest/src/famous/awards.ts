/**
 * Hand-kept award files into player_honors: seed/nfl_awards.json, seed/nba_awards.json and
 * seed/mls_awards.json share one loader. Each row names the player by the provider's own id,
 * the same id game_appearances uses, so a star lines up with the lineups. A file's rows replace
 * what its last run loaded, so deleting a line removes the honor.
 */
import { readFileSync } from 'node:fs';

import { upsertRows, type MinimalDb } from '@jinx/core';

import { ensurePlayers, refreshAllStats } from './players.js';

export interface AwardRow {
  season: number;
  honor: string;
  name: string;
  source?: string;
  [id: string]: unknown;
}

export interface AwardsFile {
  /** Absolute path, and the repo-relative name written to player_honors.source. */
  path: string;
  source: string;
  sport: string;
  provider: string;
  /** The row key that carries the provider's player id, and what it should look like. */
  idKey: string;
  idPattern: RegExp;
  idHint: string;
  honors: ReadonlySet<string>;
}

/** Shape checks: a bad row stops the run rather than loading half a file. */
export function validateAwards(file: AwardsFile, rows: readonly AwardRow[]): string[] {
  const problems: string[] = [];
  rows.forEach((r, i) => {
    if (!Number.isInteger(r.season)) problems.push(`row ${i + 1}: season must be a year`);
    if (!file.honors.has(r.honor))
      problems.push(`row ${i + 1}: honor must be one of ${[...file.honors].join(', ')}`);
    const id = r[file.idKey];
    if (typeof id !== 'string' || !file.idPattern.test(id))
      problems.push(`row ${i + 1}: ${file.idKey} looks like ${file.idHint}`);
    if (!r.name) problems.push(`row ${i + 1}: name is required`);
  });
  return problems;
}

export async function loadAwards(db: MinimalDb, file: AwardsFile): Promise<number> {
  const rows = JSON.parse(readFileSync(file.path, 'utf8')) as AwardRow[];
  const problems = validateAwards(file, rows);
  if (problems.length > 0) throw new Error(`${file.source}:\n  ${problems.join('\n  ')}`);
  const ids = await ensurePlayers(
    db,
    file.sport,
    file.provider,
    rows.map((r) => ({ providerPlayerId: String(r[file.idKey]), fullName: r.name })),
  );
  const out = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const playerId = ids.get(String(r[file.idKey]))!;
    out.set(`${playerId}:${r.season}:${r.honor}`, {
      player_id: playerId,
      season: r.season,
      honor: r.honor,
      source: file.source,
    });
  }
  const { error } = await db.from('player_honors').delete().eq('source', file.source);
  if (error) throw new Error(`clear ${file.source}: ${error.message}`);
  await upsertRows(db, 'player_honors', [...out.values()], 'player_id,season,honor');
  console.log(`${out.size} ${file.sport.toUpperCase()} honor rows from ${file.source}`);
  await refreshAllStats(db);
  return out.size;
}
