/**
 * NFL firsts into player_firsts (first touchdown), and rookie seasons into players, for the
 * "first touchdown" and "rookie season" badges.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/nfl/firsts.ts [--from 2000 --to 2026]
 *
 * First touchdown: every season's play-by-play in order, the first play with touchdown = 1 and
 * a td_player_id names the game (`firstTouchdowns`; the same column the scoring timeline uses
 * for its scorer, packages/core/src/providers/nfl/parse.ts). The floor is PBP_FLOOR: a player
 * whose rookie season is before it may have scored before the data begins, so he gets no
 * first. A first already stored is never replaced, so the daily run over the current season
 * only adds players scoring for the first time. Defaults to the current season.
 */
import { chunk, firstTouchdowns, selectAll, upsertRows, type TouchdownPlay } from '@jinx/core';

import { createDb } from '../db.js';
import { arg, ensurePlayers, loadNflPlayers, refreshAllStats } from '../famous/players.js';
import { fetchAsset, openAsset, pbpAsset } from './assets.js';
import { readCsv } from './csv.js';
import { currentNflSeason } from './run.js';

/** The first season of play-by-play this pipeline reads. */
export const PBP_FLOOR = 2000;

async function seasonPlays(season: number): Promise<TouchdownPlay[]> {
  let fetched;
  try {
    fetched = await fetchAsset(pbpAsset(season), { log: (s) => console.log(`  ${s}`) });
  } catch (err) {
    if (String(err).includes('HTTP 404')) return [];
    throw err;
  }
  const plays: (TouchdownPlay & { order: number })[] = [];
  for await (const r of readCsv(openAsset(fetched.path))) {
    if (r['touchdown'] !== '1' && r['touchdown'] !== '1.0') continue;
    plays.push({
      providerGameId: r['game_id'] ?? '',
      scorerProviderId: r['td_player_id'] || null,
      touchdown: true,
      order: Number(r['order_sequence'] ?? r['play_id'] ?? 0),
    });
  }
  // game_id is YYYY_WW_AWAY_HOME, so it sorts by week; a player plays one game a week.
  plays.sort((a, b) => a.providerGameId.localeCompare(b.providerGameId) || a.order - b.order);
  return plays;
}

async function main(): Promise<void> {
  const to = Number(arg('to') ?? currentNflSeason());
  const from = Math.max(PBP_FLOOR, Number(arg('from') ?? to));
  const db = createDb();
  const players = await loadNflPlayers();

  // Rookie seasons for every NFL player we know, from players.csv.
  const known = await selectAll<{ provider_player_id: string; full_name: string }>(
    db,
    'players',
    'provider_player_id, full_name',
    (q) => q.eq('provider', 'nflverse').is('rookie_season', null),
  );
  const rookieRows: Record<string, unknown>[] = [];
  for (const p of known) {
    const info = players.get(p.provider_player_id);
    if (info?.rookieSeason) {
      rookieRows.push({
        sport_id: 'nfl',
        full_name: p.full_name,
        provider: 'nflverse',
        provider_player_id: p.provider_player_id,
        rookie_season: info.rookieSeason,
      });
    }
  }
  await upsertRows(db, 'players', rookieRows, 'provider,provider_player_id');
  console.log(`${rookieRows.length} rookie seasons filled`);

  const firsts = new Map<string, string>();
  for (let season = from; season <= to; season += 1) {
    const found = firstTouchdowns(await seasonPlays(season));
    let added = 0;
    for (const [gsis, game] of found) {
      if (firsts.has(gsis)) continue;
      const rookie = players.get(gsis)?.rookieSeason;
      if (rookie == null || rookie < PBP_FLOOR) continue;
      firsts.set(gsis, game);
      added += 1;
    }
    console.log(`${season}: ${added} first touchdowns`);
  }

  // provider game id -> games.id, for the games we hold.
  const gameIds = new Map<string, string>();
  for (const part of chunk([...new Set(firsts.values())], 300)) {
    const { data, error: e } = await db
      .from('games')
      .select('id, provider_game_id')
      .eq('provider', 'nflverse')
      .in('provider_game_id', part);
    if (e) throw new Error(e.message);
    for (const g of (data ?? []) as { id: string; provider_game_id: string }[])
      gameIds.set(g.provider_game_id, g.id);
  }
  const placed = [...firsts].filter(([, game]) => gameIds.has(game));
  const ids = await ensurePlayers(
    db,
    'nfl',
    'nflverse',
    placed.map(([gsis]) => ({ providerPlayerId: gsis, fullName: players.get(gsis)?.name ?? gsis })),
  );
  await upsertRows(
    db,
    'player_firsts',
    placed.map(([gsis, game]) => ({
      player_id: ids.get(gsis)!,
      kind: 'first_td',
      game_id: gameIds.get(game)!,
    })),
    'player_id,kind',
    // A first already stored stays: it came from an earlier season than this run can see.
    { ignoreDuplicates: true },
  );
  console.log(`${placed.length} first touchdowns written for ${from}-${to}`);
  await refreshAllStats(db);
}

const isEntrypoint = process.argv[1] != null && /[\\/]nfl[\\/]firsts\.ts$/.test(process.argv[1]);
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
