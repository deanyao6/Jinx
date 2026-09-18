/**
 * Fills `kind` and the scorer on NFL scoring timelines written before those columns existed
 * (migration 20260917001000), for games someone attended.
 *
 *   npx tsx ingest/src/nfl/rescore.ts [--limit 200] [--force]
 *
 * The raw plays are not stored, so the rows are re-derived from the season play-by-play files
 * the pipeline already downloads (cached under ingest/.cache/nfl; `--force` re-downloads).
 * Only the scoring timeline is rewritten: appearances, moments and context stay as they are.
 * The full pipeline (`run.ts --force`) does the same for every game of a season, this does it
 * for the attended ones in minutes rather than hours.
 */
import { parseNflGame, writeTimeline } from '@jinx/core';

import { createDb, type Db } from '../db.js';
import { fetchAsset, openAsset, pbpAsset, schedulesAsset } from './assets.js';
import { readCsv, toPbpRow } from './csv.js';
import { loadScheduleRows } from './schedule.js';

type Target = { game_id: string; provider_game_id: string; season: number };

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? (process.argv[i + 1] as string) : null;
}

async function targets(db: Db, limit: number): Promise<Target[]> {
  const { data, error } = await db.rpc('games_needing_scorers', {
    p_provider: 'nflverse',
    p_limit: limit,
  });
  if (error) throw new Error(`games_needing_scorers: ${error.message}`);
  return (data ?? []) as Target[];
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const db = createDb();
  const games = await targets(db, Number(arg('limit') ?? '200'));
  if (games.length === 0) {
    console.log('every attended NFL game already has its scorers');
    return;
  }

  const { path: gamesPath } = await fetchAsset(schedulesAsset(), { force });
  const schedule = new Map(
    (await loadScheduleRows(openAsset(gamesPath))).map((r) => [r.game_id, r]),
  );

  const bySeason = new Map<number, Target[]>();
  for (const g of games) bySeason.set(g.season, [...(bySeason.get(g.season) ?? []), g]);

  let done = 0;
  for (const [season, seasonGames] of [...bySeason].sort((a, b) => a[0] - b[0])) {
    console.log(`${season}: ${seasonGames.length} game(s)`);
    const wanted = new Set(seasonGames.map((g) => g.provider_game_id));
    const fetched = await fetchAsset(pbpAsset(season), {
      force,
      log: (m) => console.log(`  ${m}`),
    });
    const plays = new Map<string, ReturnType<typeof toPbpRow>[]>();
    for await (const raw of readCsv(openAsset(fetched.path))) {
      const row = toPbpRow(raw);
      if (!wanted.has(row.game_id)) continue;
      plays.set(row.game_id, [...(plays.get(row.game_id) ?? []), row]);
    }
    for (const g of seasonGames) {
      const row = schedule.get(g.provider_game_id);
      const rows = plays.get(g.provider_game_id) ?? [];
      if (!row || rows.length === 0) {
        console.log(`  ${g.provider_game_id}: no play-by-play, left as is`);
        continue;
      }
      const detail = parseNflGame(row, rows);
      const written = await writeTimeline(db, detail, g.game_id);
      const named = detail.timeline.filter((e) => e.scorerName).length;
      console.log(
        `  ${g.provider_game_id}: ${written} scoring plays rewritten, ${named} with a scorer`,
      );
      done += 1;
    }
  }
  console.log(`done: ${done} game(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
