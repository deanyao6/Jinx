/**
 * Fetch MLB game details (appearances, scoring timeline, context, moments) and write them.
 *
 *   npx tsx ingest/src/mlb/detail.ts --pks 746419,775300         # specific games
 *   npx tsx ingest/src/mlb/detail.ts --pending [--limit 200]      # finals lacking detail that someone attended,
 *                                                                 # plus finals from the last 3 days
 */
import { createDb, loadTeamMap, loadVenueMaps, type Db } from '../db.js';
import { upsertGameDetail } from '../games.js';
import { MlbProvider } from './provider.js';

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : null;
}

async function pendingPks(db: Db, limit: number): Promise<string[]> {
  const since = new Date(Date.now() - 3 * 86400_000).toISOString();
  const { data: recent, error: e1 } = await db
    .from('games')
    .select('provider_game_id')
    .eq('provider', 'mlb')
    .eq('status', 'final')
    .is('detail_ingested_at', null)
    .gte('scheduled_start', since)
    .limit(limit);
  if (e1) throw new Error(e1.message);
  const { data: attended, error: e2 } = await db.rpc('games_needing_detail', {
    p_provider: 'mlb',
    p_limit: limit,
  });
  if (e2) throw new Error(e2.message);
  const pks = new Set<string>();
  for (const r of (recent ?? []) as { provider_game_id: string }[]) pks.add(r.provider_game_id);
  for (const r of (attended ?? []) as { provider_game_id: string }[]) pks.add(r.provider_game_id);
  return [...pks].slice(0, limit);
}

async function main(): Promise<void> {
  const db = createDb();
  const provider = new MlbProvider();
  const ctx = {
    teamMap: await loadTeamMap(db, 'mlb'),
    venueMaps: await loadVenueMaps(db),
    venueLookup: 'mlb' as const,
  };
  const limit = Number(arg('limit') ?? '200');
  const pks =
    arg('pks')
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? (process.argv.includes('--pending') ? await pendingPks(db, limit) : []);
  if (pks.length === 0) {
    console.log('nothing to do');
    return;
  }
  for (const pk of pks) {
    const detail = await provider.fetchGameDetail(pk);
    if (
      !ctx.teamMap.has(detail.homeProviderTeamId) ||
      !ctx.teamMap.has(detail.awayProviderTeamId)
    ) {
      console.log(`${pk}: skipped (non-MLB team)`);
      continue;
    }
    const r = await upsertGameDetail(db, detail, ctx);
    console.log(
      `${pk}: ${detail.awayScore}-${detail.homeScore} at ${detail.venueName}; ${r.appearances} appearances, ${r.timeline} scoring plays, ${r.events} moments`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
