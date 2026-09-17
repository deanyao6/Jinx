/**
 * Fills game_wp_timeline and game_story_steps for NFL games (SPEC 4.3b, 6.19).
 *
 * The MLB half of this reads a dedicated endpoint per game; nflverse ships win probability
 * inside the play-by-play the pipeline already downloads, so this loads one season's csv.gz
 * and writes the two tables for the games in it.
 *
 *   npx tsx ingest/src/nfl/relive.ts --attended            # games someone logged, any season
 *   npx tsx ingest/src/nfl/relive.ts --season 2025
 *   npx tsx ingest/src/nfl/relive.ts --game 2025_13_CHI_PHI
 *
 * Existing stories are left alone unless --game names one or --force is passed, so a rerun
 * is cheap.
 */
import {
  buildPbpStorySteps,
  markReliveChecked,
  parsePbpWinProbability,
  reliveTargets,
  writeRelive,
  type PbpWpRow,
} from '@jinx/core';

import { fetchAsset, openAsset, pbpAsset } from './assets.js';
import { readCsv, toPbpRow } from './csv.js';
import { createDb, type Db } from '../db.js';

type GameRow = {
  id: string;
  provider_game_id: string;
  season: number;
  home_score: number | null;
  away_score: number | null;
  home: { name: string } | null;
  away: { name: string } | null;
};

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? (process.argv[i + 1] as string) : null;
}

/**
 * The games to build stories for.
 *
 * `--attended` is the default because Relive is only ever opened from a game on someone's
 * passport, and every season of play-by-play is ~50MB: there is no reason to build stories
 * for 7,000 games nobody logged.
 */
async function targets(db: Db): Promise<GameRow[]> {
  const onlyGame = arg('game');
  const season = arg('season');
  const select =
    'id, provider_game_id, season, home_score, away_score, home:home_team_id(name), away:away_team_id(name)';

  // The attended set comes from one server-side function, games_needing_relive, never from
  // "read attendances, then filter in memory": PostgREST returns at most 1000 rows per request,
  // and that pattern silently dropped a real game once. The function also skips games that
  // already have a story, so a nightly run with nothing new downloads nothing.
  if (!onlyGame && !season) {
    const rows = await reliveTargets(db, 'nflverse', 500);
    return rows.map((r) => ({
      id: r.game_id,
      provider_game_id: r.provider_game_id,
      season: r.season,
      home_score: r.home_score,
      away_score: r.away_score,
      home: { name: r.home_name },
      away: { name: r.away_name },
    }));
  }

  let query = db.from('games').select(select).eq('provider', 'nflverse').eq('status', 'final');
  if (onlyGame) query = query.eq('provider_game_id', onlyGame);
  else query = query.eq('season', Number(season));
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as GameRow[];
}

/**
 * gsis id -> our `players.id`, for the scorers in a batch of steps.
 *
 * nflverse names a scorer by gsis id, which is what `game_appearances` is keyed by, so a
 * scorer resolves to the same row the lineup does. An id we have never seen — a player who
 * scored but recorded no snap, which the older stats-based seasons can produce — maps to
 * null and the step keeps only the name.
 */
async function resolvePlayers(db: Db, gsisIds: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(gsisIds)];
  const out = new Map<string, string>();
  // PostgREST caps a response at 1000 rows; a game has at most a dozen scorers, but chunk
  // anyway so this stays correct if it is ever pointed at a whole season.
  for (let i = 0; i < unique.length; i += 500) {
    const { data, error } = await db
      .from('players')
      .select('id, provider_player_id')
      .eq('provider', 'nflverse')
      .in('provider_player_id', unique.slice(i, i + 500));
    if (error) throw error;
    for (const row of (data ?? []) as { id: string; provider_player_id: string }[]) {
      out.set(row.provider_player_id, row.id);
    }
  }
  return out;
}

/** One season's plays, keyed by nflverse game id, keeping only the columns Relive reads. */
async function loadSeason(season: number, force: boolean): Promise<Map<string, PbpWpRow[]>> {
  const byGame = new Map<string, PbpWpRow[]>();
  const fetched = await fetchAsset(pbpAsset(season), { force, log: (m) => console.log(`  ${m}`) });
  for await (const raw of readCsv(openAsset(fetched.path))) {
    const row = toPbpRow(raw);
    const list = byGame.get(row.game_id) ?? [];
    list.push({
      play_id: row.play_id,
      qtr: row.qtr,
      desc: row.desc,
      sp: row.sp,
      home_wp: row.home_wp ?? null,
      total_home_score: row.total_home_score,
      total_away_score: row.total_away_score,
      time_of_day: row.time_of_day,
      // The touchdown scorer first: it is set for a rushing, receiving, pick six, fumble
      // return and kick return alike. The kicker only matters when nobody reached the end
      // zone, which is a field goal or an extra point.
      scorer_player_id: row.td_player_id || row.kicker_player_id || null,
      scorer_name: row.td_player_name || row.kicker_player_name || null,
    });
    byGame.set(row.game_id, list);
  }
  return byGame;
}

async function main() {
  const force = process.argv.includes('--force');
  const onlyGame = arg('game');
  const db = createDb();

  await settleQueue(db);
  const games = await targets(db);
  if (games.length === 0) {
    console.log('no final NFL games are missing a story');
    return;
  }

  // Group by season so each play-by-play file is read once however many games need it.
  const bySeason = new Map<number, GameRow[]>();
  for (const g of games) {
    const list = bySeason.get(g.season) ?? [];
    list.push(g);
    bySeason.set(g.season, list);
  }

  let done = 0;
  for (const [season, seasonGames] of [...bySeason].sort((a, b) => a[0] - b[0])) {
    // Skip the download entirely when every game in the season already has a story.
    const pending: GameRow[] = [];
    for (const g of seasonGames) {
      if (force || onlyGame) {
        pending.push(g);
        continue;
      }
      // The shared Db interface has no count(); one row is enough to know a story exists.
      const existing = await db.from('game_story_steps').select('seq').eq('game_id', g.id).limit(1);
      if ((existing.data?.length ?? 0) === 0) pending.push(g);
    }
    if (pending.length === 0) continue;

    console.log(`${season}: ${pending.length} game(s)`);
    let plays: Map<string, PbpWpRow[]>;
    try {
      plays = await loadSeason(season, force);
    } catch (err) {
      if (String(err).includes('HTTP 404')) {
        console.log(`  play_by_play_${season}.csv.gz not published yet; skipped`);
        continue;
      }
      throw err;
    }

    for (const g of pending) {
      const rows = plays.get(g.provider_game_id) ?? [];
      const points = parsePbpWinProbability(rows);
      if (points.length === 0) {
        console.log(`  ${g.provider_game_id}: no win probability in the play-by-play, skipped`);
        // Looked, and there is nothing to build. Recent games are still retried for two weeks
        // (games_needing_relive), because nflverse publishes a game's plays a day or so late.
        await markReliveChecked(db, g.id);
        continue;
      }
      const steps = buildPbpStorySteps(rows, points, {
        awayScore: g.away_score ?? 0,
        homeScore: g.home_score ?? 0,
        awayName: g.away?.name ?? 'Away',
        homeName: g.home?.name ?? 'Home',
      });

      const players = await resolvePlayers(
        db,
        steps.map((s) => s.scorerProviderId).filter((id): id is string => !!id),
      );
      await writeRelive(
        db,
        g.id,
        points,
        steps.map((s) => ({
          ...s,
          scorerPlayerId: s.scorerProviderId ? (players.get(s.scorerProviderId) ?? null) : null,
        })),
      );
      done += 1;
      const named = steps.filter((s) => s.scorerName).length;
      console.log(
        `  ${g.provider_game_id}: ${points.length} probability points, ${steps.length} story steps, ${named} with a scorer`,
      );
    }
  }
  console.log(`done: ${done} game(s)`);
}

/** NFL detail arrives in bulk, so queue rows for NFL games are closed here rather than one by one. */
async function settleQueue(db: Db): Promise<void> {
  const { data, error } = await db.rpc('detail_queue_settle');
  if (error) throw new Error(`detail_queue_settle: ${error.message}`);
  console.log(`detail queue: ${Number(data ?? 0)} row(s) closed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
