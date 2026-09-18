/**
 * Fetch NBA game details (appearances, scoring timeline, context, moments) and write them.
 *
 *   npx tsx ingest/src/nba/detail.ts --ids 0022400001,0021600001   # specific games
 *   npx tsx ingest/src/nba/detail.ts --pending [--limit 200]        # finals lacking detail that someone logged
 *   npx tsx ingest/src/nba/detail.ts --queue                        # drain detail_queue and build stories,
 *                                                                   # exactly as the nba-sync function does
 *
 * `--pending` is the net under the nba-sync Edge Function, which drains `detail_queue` every 15
 * minutes. It asks only for logged games (SPEC.md 4.7).
 */
import { detailContextFor, drainNbaQueue } from '@jinx/core';

import { createDb, loadTeamMap, loadVenueMaps, type Db } from '../db.js';
import { upsertGameDetail } from '../games.js';
import { nbaProvider } from './provider.js';

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : null;
}

async function pendingIds(db: Db, limit: number): Promise<{ id: string; provider_game_id: string }[]> {
  const { data, error } = await db.rpc('games_needing_detail', { p_provider: 'nba', p_limit: limit });
  if (error) throw new Error(error.message);
  const ids = ((data ?? []) as { provider_game_id: string }[]).map((r) => r.provider_game_id);
  if (ids.length === 0) return [];
  const { data: rows, error: rowsErr } = await db
    .from('games')
    .select('id, provider_game_id')
    .eq('provider', 'nba')
    .in('provider_game_id', ids);
  if (rowsErr) throw new Error(rowsErr.message);
  return (rows ?? []) as { id: string; provider_game_id: string }[];
}

async function main(): Promise<void> {
  const db = createDb();
  const provider = nbaProvider();
  const limit = Number(arg('limit') ?? '200');
  const ctx = {
    teamMap: await loadTeamMap(db, 'nba'),
    venueMaps: await loadVenueMaps(db),
    venueLookup: 'nba' as const,
  };
  if (process.argv.includes('--queue')) {
    const result = await drainNbaQueue(db, provider, provider.client, ctx, { detailLimit: limit, reliveLimit: limit });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  let targets: { id: string | null; provider_game_id: string }[];
  const ids = arg('ids')?.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids?.length) {
    const { data } = await db.from('games').select('id, provider_game_id').eq('provider', 'nba').in('provider_game_id', ids);
    const known = new Map(((data ?? []) as { id: string; provider_game_id: string }[]).map((r) => [r.provider_game_id, r.id]));
    targets = ids.map((id) => ({ id: known.get(id) ?? null, provider_game_id: id }));
  } else if (process.argv.includes('--pending')) {
    targets = await pendingIds(db, limit);
  } else {
    targets = [];
  }
  if (targets.length === 0) {
    console.log('nothing to do');
    return;
  }
  for (const t of targets) {
    const detailCtx = t.id ? await detailContextFor(db, t.id, t.provider_game_id) : undefined;
    const detail = await provider.fetchGameDetail(t.provider_game_id, detailCtx);
    if (!ctx.teamMap.has(detail.homeProviderTeamId) || !ctx.teamMap.has(detail.awayProviderTeamId)) {
      console.log(`${t.provider_game_id}: skipped (unknown team ${detail.homeProviderTeamId} / ${detail.awayProviderTeamId})`);
      continue;
    }
    const r = await upsertGameDetail(db, detail, ctx);
    const wallClock = detail.plays.sport === 'nba' && detail.plays.items.some((p) => p.timeActual);
    console.log(
      `${t.provider_game_id}: ${detail.awayScore}-${detail.homeScore} at ${detail.venueName ?? '?'}; ${r.appearances} appearances, ${r.timeline} scoring plays, ${r.events} moments, attendance ${detail.attendance ?? '?'}, ${detail.durationMinutes ?? '?'} min, ${wallClock ? 'wall clock' : 'no wall clock'}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
