/**
 * Fills game_wp_timeline and game_story_steps for games a user attended (SPEC 4.3b, 6.19).
 *
 * MLB publishes per-play win probability at /v1/game/{gamePk}/winProbability, verified in
 * docs/verification.md, so the line under Relive is real rather than modelled.
 *
 * The scheduled path is the `mlb-sync` Edge Function, which runs the same code every 15
 * minutes. This script is the manual and catch-up route:
 *
 *   npx tsx ingest/src/mlb/relive.ts --attended [--limit 300]   # attended games with no story
 *   npx tsx ingest/src/mlb/relive.ts --game <gamePk>            # rebuild one game
 *   npx tsx ingest/src/mlb/relive.ts --rebuild                  # rebuild every existing MLB story,
 *                                                               # after a change to how steps are built
 */
import { MlbClient, buildMlbRelive, reliveTargets, selectAll, type ReliveTarget } from '@jinx/core';

import { createDb, type Db } from '../db.js';

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? (process.argv[i + 1] as string) : null;
}

const GAME_COLUMNS =
  'id, provider_game_id, season, home_score, away_score, home:home_team_id(name), away:away_team_id(name)';

/** One game by gamePk, or, with no gamePk, every MLB game that already has a story. */
async function existingGames(db: Db, gamePk: string | null): Promise<ReliveTarget[]> {
  let data: unknown[];
  if (gamePk) {
    const res = await db
      .from('games')
      .select(GAME_COLUMNS)
      .eq('provider', 'mlb')
      .eq('status', 'final')
      .eq('provider_game_id', gamePk);
    if (res.error) throw new Error(res.error.message);
    data = res.data ?? [];
  } else {
    // Paged and filtered on the server: a plain select stops at 1000 rows without saying so.
    const withStory = await selectAll<{ game_id: string }>(db, 'game_story_steps', 'game_id', (q) =>
      q.eq('seq', 1),
    );
    data = [];
    const ids = withStory.map((r) => r.game_id);
    for (let i = 0; i < ids.length; i += 200) {
      const res = await db
        .from('games')
        .select(GAME_COLUMNS)
        .eq('provider', 'mlb')
        .eq('status', 'final')
        .in('id', ids.slice(i, i + 200));
      if (res.error) throw new Error(res.error.message);
      data.push(...(res.data ?? []));
    }
  }
  type Row = Omit<ReliveTarget, 'game_id' | 'home_name' | 'away_name'> & {
    id: string;
    home: { name: string } | null;
    away: { name: string } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((g) => ({
    game_id: g.id,
    provider_game_id: g.provider_game_id,
    season: g.season,
    home_score: g.home_score,
    away_score: g.away_score,
    home_name: g.home?.name ?? 'Home',
    away_name: g.away?.name ?? 'Away',
  }));
}

async function main() {
  const onlyGame = arg('game');
  const db = createDb();
  const client = new MlbClient();
  const rebuild = process.argv.includes('--rebuild');
  const games =
    onlyGame || rebuild
      ? await existingGames(db, onlyGame)
      : await reliveTargets(db, 'mlb', Number(arg('limit') ?? '300'));
  if (games.length === 0) {
    console.log('no attended final MLB games are missing a story');
    return;
  }

  let done = 0;
  for (const g of games) {
    const built = await buildMlbRelive(db, client, g);
    if (!built) {
      console.log(`${g.provider_game_id}: no win probability published, skipped`);
      continue;
    }
    done += 1;
    console.log(
      `${g.provider_game_id}: ${built.points} probability points, ${built.steps} story steps`,
    );
  }
  console.log(`done: ${done} game(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
