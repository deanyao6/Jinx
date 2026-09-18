/**
 * Fills game_wp_timeline and game_story_steps for NBA games a user attended (SPEC 4.3b, 6.19).
 *
 * The scheduled path is the `nba-sync` Edge Function, which runs the same code every 15
 * minutes. This script is the manual and catch-up route:
 *
 *   npx tsx ingest/src/nba/relive.ts --attended [--limit 300]   # attended games with no story
 *   npx tsx ingest/src/nba/relive.ts --game <gameId>            # rebuild one game
 *   npx tsx ingest/src/nba/relive.ts --rebuild                  # rebuild every existing NBA story
 */
import { buildNbaRelive, reliveTargets, selectAll, type ReliveTarget } from '@jinx/core';

import { createDb, type Db } from '../db.js';
import { nbaProvider } from './provider.js';

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? (process.argv[i + 1] as string) : null;
}

const GAME_COLUMNS =
  'id, provider_game_id, season, scheduled_start, home_score, away_score, home:home_team_id(name), away:away_team_id(name)';

type Row = {
  id: string;
  provider_game_id: string;
  season: number;
  scheduled_start: string;
  home_score: number | null;
  away_score: number | null;
  home: { name: string } | null;
  away: { name: string } | null;
};

async function existingGames(
  db: Db,
  gameId: string | null,
): Promise<(ReliveTarget & { scheduled_start: string })[]> {
  let data: unknown[] = [];
  if (gameId) {
    const res = await db
      .from('games')
      .select(GAME_COLUMNS)
      .eq('provider', 'nba')
      .eq('status', 'final')
      .eq('provider_game_id', gameId);
    if (res.error) throw new Error(res.error.message);
    data = res.data ?? [];
  } else {
    const withStory = await selectAll<{ game_id: string }>(db, 'game_story_steps', 'game_id', (q) =>
      q.eq('seq', 1),
    );
    const ids = withStory.map((r) => r.game_id);
    for (let i = 0; i < ids.length; i += 200) {
      const res = await db
        .from('games')
        .select(GAME_COLUMNS)
        .eq('provider', 'nba')
        .eq('status', 'final')
        .in('id', ids.slice(i, i + 200));
      if (res.error) throw new Error(res.error.message);
      data.push(...(res.data ?? []));
    }
  }
  return (data as Row[]).map((g) => ({
    game_id: g.id,
    provider_game_id: g.provider_game_id,
    season: g.season,
    scheduled_start: g.scheduled_start,
    home_score: g.home_score,
    away_score: g.away_score,
    home_name: g.home?.name ?? 'Home',
    away_name: g.away?.name ?? 'Away',
  }));
}

async function main() {
  const onlyGame = arg('game');
  const db = createDb();
  const client = nbaProvider().client;
  const rebuild = process.argv.includes('--rebuild');
  const games =
    onlyGame || rebuild
      ? await existingGames(db, onlyGame)
      : await reliveTargets(db, 'nba', Number(arg('limit') ?? '300'));
  if (games.length === 0) {
    console.log('no attended final NBA games are missing a story');
    return;
  }
  let done = 0;
  for (const g of games) {
    const built = await buildNbaRelive(db, client, g);
    if (!built) {
      console.log(`${g.provider_game_id}: no scoring timeline yet, skipped`);
      continue;
    }
    done += 1;
    console.log(
      `${g.provider_game_id}: ${built.points} probability points (${built.source}), ${built.steps} story steps`,
    );
  }
  console.log(`done: ${done} game(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
