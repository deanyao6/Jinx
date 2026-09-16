/**
 * MLB schedule + finals backfill, resumable per season.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/mlb/backfill.ts --from 2000 --to 2026 [--force]
 *
 * Details (appearances, timeline, moments) are not fetched here; see detail.ts. They are pulled
 * on demand for attended games and for the rolling current-season window.
 */
import { createDb, getProgress, loadTeamMap, loadVenueMaps, setProgress } from '../db.js';
import { upsertGames } from '../games.js';
import { MlbProvider } from './provider.js';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

async function main(): Promise<void> {
  const from = Number(arg('from', '2000'));
  const to = Number(arg('to', String(new Date().getUTCFullYear())));
  const force = process.argv.includes('--force');
  const db = createDb();
  const provider = new MlbProvider();
  const ctx = {
    teamMap: await loadTeamMap(db, 'mlb'),
    venueMaps: await loadVenueMaps(db),
    venueLookup: 'mlb' as const,
  };
  const job = 'mlb_backfill';

  for (let season = from; season <= to; season++) {
    const key = String(season);
    if (!force && (await getProgress(db, job, key)) === 'done') {
      console.log(`season ${season}: already done, skipping`);
      continue;
    }
    await setProgress(db, job, key, 'running');
    try {
      const games = await provider.fetchSeason(season);
      const known = games.filter(
        (g) => ctx.teamMap.has(g.homeProviderTeamId) && ctx.teamMap.has(g.awayProviderTeamId),
      );
      const skipped = games.length - known.length;
      await upsertGames(db, known, ctx);
      const finals = known.filter((g) => g.status === 'final').length;
      await setProgress(db, job, key, 'done', {
        games: known.length,
        finals,
        skipped_unknown_teams: skipped,
      });
      console.log(
        `season ${season}: ${known.length} games (${finals} final, ${skipped} skipped non-MLB teams)`,
      );
    } catch (err) {
      await setProgress(db, job, key, 'failed', { error: String(err) });
      throw err;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
