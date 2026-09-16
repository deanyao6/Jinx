/**
 * Fills game_wp_timeline and game_story_steps for games a user attended (SPEC 4.3b, 6.19).
 *
 * MLB publishes per-play win probability at /v1/game/{gamePk}/winProbability, verified in
 * docs/verification.md, so the line under Relive is real rather than modelled. Runs over
 * games that already have detail and no story yet.
 *
 *   npx tsx ingest/src/mlb/relive.ts --attended
 *   npx tsx ingest/src/mlb/relive.ts --game <gamePk>
 */
import { MlbClient, buildStorySteps, parseWinProbability } from '@jinx/core';

import { createDb } from '../db.js';

type GameRow = {
  id: string;
  provider_game_id: string;
  home_score: number | null;
  away_score: number | null;
  home: { name: string } | null;
  away: { name: string } | null;
};

async function main() {
  const args = process.argv.slice(2);
  const onlyGame = args.includes('--game') ? args[args.indexOf('--game') + 1] : null;
  const db = createDb();
  const client = new MlbClient();

  let query = db
    .from('games')
    .select(
      'id, provider_game_id, home_score, away_score, home:home_team_id(name), away:away_team_id(name)',
    )
    .eq('provider', 'mlb')
    .eq('status', 'final')
    .not('detail_ingested_at', 'is', null);
  if (onlyGame) query = query.eq('provider_game_id', onlyGame);

  const { data, error } = await query;
  if (error) throw error;
  const games = (data ?? []) as unknown as GameRow[];
  if (games.length === 0) {
    console.log('no final games with detail; run ingest/src/mlb/detail.ts first');
    return;
  }

  let done = 0;
  for (const g of games) {
    // The shared Db interface has no count(); one row is enough to know a story exists.
    const existing = await db.from('game_story_steps').select('seq').eq('game_id', g.id).limit(1);
    if (!onlyGame && (existing.data?.length ?? 0) > 0) continue;

    const entries = await client.getJson<unknown[]>(`v1/game/${g.provider_game_id}/winProbability`);
    const points = parseWinProbability(entries as never[]);
    if (points.length === 0) {
      console.log(`${g.provider_game_id}: no win probability published, skipped`);
      continue;
    }
    const steps = buildStorySteps(entries as never[], points, {
      awayScore: g.away_score ?? 0,
      homeScore: g.home_score ?? 0,
      awayName: g.away?.name ?? 'Away',
      homeName: g.home?.name ?? 'Home',
    });

    // Points first: story steps reference (game_id, wp_seq).
    await db.from('game_story_steps').delete().eq('game_id', g.id);
    await db.from('game_wp_timeline').delete().eq('game_id', g.id);
    const wpRows = points.map((p) => ({
      game_id: g.id,
      seq: p.seq,
      period: p.period,
      half: p.half,
      home_wp: p.homeWp,
      occurred_at: p.occurredAt,
    }));
    const { error: wpError } = await db.from('game_wp_timeline').insert(wpRows);
    if (wpError) throw wpError;
    const { error: stepError } = await db.from('game_story_steps').insert(
      steps.map((s) => ({
        game_id: g.id,
        seq: s.seq,
        wp_seq: s.wpSeq,
        away_score: s.awayScore,
        home_score: s.homeScore,
        label: s.label,
        text: s.text,
      })),
    );
    if (stepError) throw stepError;
    done += 1;
    console.log(
      `${g.provider_game_id}: ${points.length} probability points, ${steps.length} story steps`,
    );
  }
  console.log(`done: ${done} game(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
