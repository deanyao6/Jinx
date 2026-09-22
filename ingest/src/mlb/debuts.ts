/**
 * MLB debut dates into players.debut_on (and rookie_season, the debut's year), for the "Saw
 * {name}'s MLB debut" and "rookie season" badges.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/mlb/debuts.ts [--all]
 *
 * GET v1/people?personIds=... carries mlbDebutDate (verified 2026-09-17). Batched 100 ids a
 * request through MlbClient's rate limit. By default only players without a debut date are
 * asked about; a player who has not debuted yet stays null and is asked again next run.
 */
import { chunk, selectAll, upsertRows } from '@jinx/core';

import { createDb } from '../db.js';
import { flag, refreshAllStats } from '../famous/players.js';
import { MlbClient } from './client.js';

interface PlayerRow {
  provider_player_id: string;
  full_name: string;
  debut_on: string | null;
}

async function main(): Promise<void> {
  const db = createDb();
  const client = new MlbClient();
  const players = (
    await selectAll<PlayerRow>(db, 'players', 'provider_player_id, full_name, debut_on', (q) =>
      q.eq('provider', 'mlb'),
    )
  ).filter((p) => flag('all') || p.debut_on == null);
  const byId = new Map(players.map((p) => [p.provider_player_id, p]));

  let found = 0;
  for (const part of chunk(
    [...byId.keys()].filter((id) => /^\d+$/.test(id)),
    100,
  )) {
    const res = await client.people(part);
    const rows = [];
    for (const p of res.people ?? []) {
      const known = byId.get(String(p.id));
      if (!known || !p.mlbDebutDate) continue;
      rows.push({
        sport_id: 'mlb',
        full_name: known.full_name,
        provider: 'mlb',
        provider_player_id: String(p.id),
        debut_on: p.mlbDebutDate,
        rookie_season: Number(p.mlbDebutDate.slice(0, 4)),
      });
    }
    await upsertRows(db, 'players', rows, 'provider,provider_player_id');
    found += rows.length;
  }
  console.log(`${found} of ${byId.size} players have a debut date`);
  await refreshAllStats(db);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
