/**
 * Fetch MLB game details (appearances, scoring timeline, context, moments) and write them.
 *
 *   npx tsx ingest/src/mlb/detail.ts --pks 746419,775300         # specific games
 *   npx tsx ingest/src/mlb/detail.ts --pending [--limit 200]      # finals lacking detail that someone logged
 *
 * `--pending` is the net under the mlb-sync Edge Function, which drains `detail_queue` every 15
 * minutes. It asks only for logged games: SPEC.md 4.7 keeps detail out of the database for games
 * nobody cares about, so a recent final is not a reason by itself.
 */
import { createDb, loadTeamMap, loadVenueMaps, type Db } from '../db.js';
import { upsertGameDetail } from '../games.js';
import { MlbProvider } from './provider.js';

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : null;
}

async function pendingPks(db: Db, limit: number): Promise<string[]> {
  const { data, error } = await db.rpc('games_needing_detail', {
    p_provider: 'mlb',
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { provider_game_id: string }[]).map((r) => r.provider_game_id);
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
