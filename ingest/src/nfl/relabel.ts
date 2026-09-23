/**
 * The NFL upgrade path (docs/prompts/social/03, section 3.2, under 00_repo_reality.md R1): a
 * live NFL prompt only knew the score changed ("Touchdown, Eagles"). Once nflverse
 * play-by-play lands overnight, this rewrites every such prompt to the real play, recomputes
 * its significance from nflverse's own `home_wp`, pins it to the point on the win probability
 * line, and pins the reactions taken on it. `label` keeps the coarse words; `label_final`
 * gets the real ones.
 *
 *   npx tsx ingest/src/nfl/relabel.ts            # every unrelabelled NFL prompt whose game is final
 *   npx tsx ingest/src/nfl/relabel.ts --game 2026_03_ATL_GB
 *
 * Runs after ingest/src/nfl/relive.ts in .github/workflows/nfl-ingest.yml, so the line the
 * prompt is pinned to exists.
 */
import { relabelPrompt, type RelabelPlay } from '@jinx/core';

import { fetchAsset, openAsset, pbpAsset } from './assets.js';
import { readCsv, toPbpRow } from './csv.js';
import { createDb, type Db } from '../db.js';

type PromptRow = {
  id: string;
  game_id: string;
  home_score: number | null;
  away_score: number | null;
  game: { provider_game_id: string; season: number; status: string } | null;
};

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? (process.argv[i + 1] as string) : null;
}

/** The prompts to rewrite: NFL, not yet relabelled, with a score to match, game final. */
async function targets(db: Db): Promise<PromptRow[]> {
  const onlyGame = arg('game');
  let query = db
    .from('reaction_prompts')
    .select('id, game_id, home_score, away_score, game:games!inner(provider_game_id, season, status)')
    .is('label_final', null)
    .eq('games.provider', 'nflverse')
    .eq('games.status', 'final')
    .not('home_score', 'is', null)
    .limit(500);
  if (onlyGame) query = query.eq('games.provider_game_id', onlyGame);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PromptRow[];
}

/** One season's plays by game, the columns the relabel reads. */
async function loadSeason(season: number): Promise<Map<string, RelabelPlay[]>> {
  const byGame = new Map<string, RelabelPlay[]>();
  const fetched = await fetchAsset(pbpAsset(season), { log: (m) => console.log(`  ${m}`) });
  for await (const raw of readCsv(openAsset(fetched.path))) {
    const row = toPbpRow(raw);
    const list = byGame.get(row.game_id) ?? [];
    list.push({
      qtr: row.qtr,
      desc: row.desc,
      sp: row.sp,
      home_wp: row.home_wp ?? null,
      total_home_score: row.total_home_score,
      total_away_score: row.total_away_score,
      play_type: row.play_type,
      yards_gained: row.yards_gained ?? null,
      td_player_name: row.td_player_name ?? null,
      return_touchdown: row.return_touchdown,
      interception: row.interception,
      fumble: row.fumble,
      safety: row.safety,
      field_goal_result: row.field_goal_result,
      kick_distance: row.kick_distance,
      touchdown: row.touchdown,
    });
    byGame.set(row.game_id, list);
  }
  return byGame;
}

export async function relabelAll(db: Db, prompts: PromptRow[], plays: Map<string, RelabelPlay[]>, now = new Date()): Promise<number> {
  let done = 0;
  const games = new Set<string>();
  for (const p of prompts) {
    const rows = p.game ? plays.get(p.game.provider_game_id) : undefined;
    if (!rows || p.home_score == null || p.away_score == null) continue;
    const r = relabelPrompt({ homeScore: p.home_score, awayScore: p.away_score }, rows);
    if (!r) {
      console.log(`  ${p.game?.provider_game_id}: no scoring play reads ${p.away_score}-${p.home_score}; left as it was`);
      continue;
    }
    const { error } = await db
      .from('reaction_prompts')
      .update({ label_final: r.labelFinal, significance: r.significance, wp_seq: r.wpSeq, period_label: r.periodLabel, relabeled_at: now.toISOString() })
      .eq('id', p.id);
    if (error) throw new Error(error.message);
    // The reactions taken on it sit on the same point.
    const { error: rxError } = await db.from('reactions').update({ wp_seq: r.wpSeq, period_label: r.periodLabel }).eq('prompt_id', p.id);
    if (rxError) throw new Error(rxError.message);
    games.add(p.game_id);
    done += 1;
    console.log(`  ${p.game?.provider_game_id}: "${r.labelFinal}" (${r.significance} points, point ${r.wpSeq})`);
  }
  // Self-triggered reactions and anything else unpinned: the last point at or before the capture.
  for (const gameId of games) {
    const { error } = await db.rpc('pin_reactions', { p_game_id: gameId });
    if (error) throw new Error(error.message);
  }
  return done;
}

async function main() {
  const db = createDb();
  const prompts = await targets(db);
  if (prompts.length === 0) {
    console.log('no NFL prompts are waiting for their play');
    return;
  }
  const seasons = [...new Set(prompts.map((p) => p.game?.season).filter((s): s is number => s != null))].sort();
  let total = 0;
  for (const season of seasons) {
    const mine = prompts.filter((p) => p.game?.season === season);
    console.log(`${season}: ${mine.length} prompt(s)`);
    const plays = await loadSeason(season);
    total += await relabelAll(db, mine, plays);
  }
  console.log(`relabelled ${total} of ${prompts.length}`);
}

if (process.argv[1] && /relabel\.(ts|js)$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
