/**
 * M8.5 done-when: "Relive plays correctly for 5 real MLB and 5 real NFL games, including an
 * extra-innings game and an overtime game." This checks that, against a source the story was
 * not built from.
 *
 *   MLB  the story comes from /winProbability; it is compared with the scoring plays in the
 *        game feed (/feed/live), a different endpoint.
 *   NFL  the story comes from the play-by-play's win probability rows; it is compared with
 *        game_scoring_timeline, which a different parser writes (parseNflGame).
 *
 * For every game: each change of score has a step, in order; the last scoring step is the final
 * score; every step sits on a real probability point; the line ends decided (0 or 1); and the
 * extra period is labelled as one.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/verify/relive.ts
 *
 * NFL games must already have a story (ingest/src/nfl/relive.ts --game <id>). Exits non-zero on
 * any mismatch.
 */
import { MlbClient, buildStorySteps, parseWinProbability } from '@jinx/core';

import { createDb } from '../db.js';

/**
 * 775300 is the extra-innings case: 2024 World Series Game 1, a walk-off grand slam in the 10th.
 * 718780 is the game whose two runs without an RBI the story used to drop.
 */
const MLB = ['775300', '813026', '823191', '718780', '746419'];
/** Two overtime games among them. */
const NFL = [
  '2025_16_GB_CHI',
  '2025_20_BUF_DEN',
  '2025_13_CHI_PHI',
  '2024_22_KC_PHI',
  '2025_01_DAL_PHI',
];

type Feed = {
  gameData: { teams: { away: { name: string }; home: { name: string } } };
  liveData: {
    linescore: { teams: { away: { runs: number }; home: { runs: number } }; currentInning: number };
    plays: {
      scoringPlays: number[];
      allPlays: { result: { awayScore: number; homeScore: number } }[];
    };
  };
};

const problems: string[] = [];
const fail = (game: string, message: string) => {
  problems.push(`${game}: ${message}`);
  console.log(`  FAIL ${message}`);
};

/** Consecutive duplicates removed: two scoring plays in one plate appearance are one change. */
function dedupe(scores: string[]): string[] {
  return scores.filter((s, i) => i === 0 || s !== scores[i - 1]);
}

async function checkMlb(client: MlbClient, pk: string): Promise<void> {
  const feed = await client.getJson<Feed>(`v1.1/game/${pk}/feed/live`);
  const entries = await client.getJson<unknown[]>(`v1/game/${pk}/winProbability`);
  const away = feed.liveData.linescore.teams.away.runs;
  const home = feed.liveData.linescore.teams.home.runs;
  const innings = feed.liveData.linescore.currentInning;
  const name = `${pk} ${feed.gameData.teams.away.name} ${away}, ${feed.gameData.teams.home.name} ${home} (${innings} inn.)`;
  console.log(name);

  const points = parseWinProbability(entries as never[]);
  const steps = buildStorySteps(entries as never[], points, {
    awayScore: away,
    homeScore: home,
    awayName: feed.gameData.teams.away.name,
    homeName: feed.gameData.teams.home.name,
  });
  const story = dedupe(steps.slice(1, -1).map((s) => `${s.awayScore}-${s.homeScore}`));
  const truth = dedupe(
    feed.liveData.plays.scoringPlays.map((i) => {
      const r = feed.liveData.plays.allPlays[i]!.result;
      return `${r.awayScore}-${r.homeScore}`;
    }),
  );
  if (story.join(' ') !== truth.join(' ')) {
    fail(pk, `score changes differ\n    story ${story.join(' ')}\n    feed  ${truth.join(' ')}`);
  }
  if (story.at(-1) !== `${away}-${home}`)
    fail(pk, `last scoring step ${story.at(-1)} is not the final`);
  const seqs = new Set(points.map((p) => p.seq));
  if (!steps.every((s) => seqs.has(s.wpSeq))) fail(pk, 'a step points at no probability point');
  const end = points.at(-1)?.homeWp;
  if (end !== 0 && end !== 1) fail(pk, `the line ends at ${end}, not decided`);
  if (innings > 9 && !steps.some((s) => /1\dth|\d{2}th/.test(s.label))) {
    fail(pk, 'extra innings, and no step is labelled with one');
  }
  console.log(
    `  ${points.length} points, ${steps.length} steps, ${truth.length} score changes matched`,
  );
}

async function checkNfl(db: ReturnType<typeof createDb>, id: string): Promise<void> {
  const { data: games, error } = await db
    .from('games')
    .select('id, home_score, away_score, innings_or_periods')
    .eq('provider', 'nflverse')
    .eq('provider_game_id', id);
  if (error) throw new Error(error.message);
  const g = (games ?? [])[0] as
    | { id: string; home_score: number; away_score: number; innings_or_periods: number | null }
    | undefined;
  if (!g) return fail(id, 'not in the database');
  console.log(
    `${id} final ${g.away_score}-${g.home_score} (${g.innings_or_periods ?? '?'} periods)`,
  );

  const steps = ((
    await db
      .from('game_story_steps')
      .select('seq, wp_seq, away_score, home_score, label')
      .eq('game_id', g.id)
      .order('seq')
  ).data ?? []) as {
    seq: number;
    wp_seq: number;
    away_score: number;
    home_score: number;
    label: string;
  }[];
  const truthRows = ((
    await db
      .from('game_scoring_timeline')
      .select('seq, away_score, home_score')
      .eq('game_id', g.id)
      .order('seq')
  ).data ?? []) as { away_score: number; home_score: number }[];
  const wp = ((
    await db.from('game_wp_timeline').select('seq, home_wp').eq('game_id', g.id).order('seq')
  ).data ?? []) as { seq: number; home_wp: number }[];
  if (steps.length === 0) return fail(id, 'no story; run ingest/src/nfl/relive.ts --game first');

  const story = dedupe(steps.slice(1, -1).map((s) => `${s.away_score}-${s.home_score}`));
  const truth = dedupe(truthRows.map((r) => `${r.away_score}-${r.home_score}`));
  // A touchdown and its extra point are separate plays in both; compare the states reached.
  const missing = truth.filter((t) => !story.includes(t));
  const invented = story.filter((s) => !truth.includes(s));
  if (missing.length) fail(id, `scores never shown: ${missing.join(' ')}`);
  if (invented.length) fail(id, `scores that never happened: ${invented.join(' ')}`);
  if (story.at(-1) !== `${g.away_score}-${g.home_score}`)
    fail(id, `last scoring step ${story.at(-1)} is not the final`);
  const seqs = new Set(wp.map((p) => p.seq));
  if (!steps.every((s) => seqs.has(s.wp_seq))) fail(id, 'a step points at no probability point');
  const end = Number(wp.at(-1)?.home_wp);
  const homeWon = g.home_score > g.away_score;
  if (g.home_score !== g.away_score && (homeWon ? end < 0.9 : end > 0.1)) {
    fail(id, `the line ends at ${end} but the ${homeWon ? 'home' : 'away'} team won`);
  }
  if ((g.innings_or_periods ?? 4) > 4 && !steps.some((s) => /OT|overtime/i.test(s.label))) {
    fail(id, 'overtime, and no step is labelled with it');
  }
  console.log(
    `  ${wp.length} points, ${steps.length} steps, ${truth.length} scoring states matched`,
  );
}

async function main() {
  const client = new MlbClient();
  console.log('MLB, story vs the game feed');
  for (const pk of MLB) await checkMlb(client, pk);
  console.log('\nNFL, story vs game_scoring_timeline');
  const db = createDb();
  for (const id of NFL) await checkNfl(db, id);
  console.log(
    problems.length === 0 ? '\nall 10 games check out' : `\n${problems.length} problem(s)`,
  );
  process.exit(problems.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
