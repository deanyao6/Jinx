/**
 * M8.5 done-when: "Relive plays correctly for 5 real MLB and 5 real NFL games, including an
 * extra-innings game and an overtime game." This checks that, against a source the story was
 * not built from. The NBA (2026-09-18) adds 5 real games to the same bar.
 *
 *   MLB  the story comes from /winProbability; it is compared with the scoring plays in the
 *        game feed (/feed/live), a different endpoint.
 *   NFL  the story comes from the play-by-play's win probability rows; it is compared with
 *        game_scoring_timeline, which a different parser writes (parseNflGame).
 *   NBA  the story comes from game_scoring_timeline (the CDN or stats.nba.com play-by-play);
 *        it is compared with ESPN's play list for the same game, a different provider. The
 *        step rule keeps a subset of scores, so every step's score must be a state ESPN saw,
 *        every score in the last three minutes must be a step, the final must match, and the
 *        overtime game and the two buzzer-beaters must be labelled and detected.
 *
 * For every game: each change of score has a step, in order; the last scoring step is the final
 * score; every step sits on a real probability point; the line ends decided (0 or 1); and the
 * extra period is labelled as one.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/verify/relive.ts
 *
 * NFL games must already have a story (ingest/src/nfl/relive.ts --game <id>), MLS matches too
 * (ingest/src/mls/detail.ts --events <ids>). Exits non-zero on any mismatch.
 */
import {
  MlbClient,
  NbaClient,
  buildStorySteps,
  clockToSeconds,
  easternDateOf,
  espnKey,
  parseEspnScoreboard,
  parseWinProbability,
} from '@jinx/core';

import { createDb } from '../db.js';
import { mlsProvider } from '../mls/provider.js';
import { diskCache } from '../nba/cache.js';

/**
 * 775300 is the extra-innings case: 2024 World Series Game 1, a walk-off grand slam in the 10th.
 * 718780 is the game whose two runs without an RBI the story used to drop.
 */
const MLB = ['775300', '813026', '823191', '718780', '746419'];
/**
 * 0022400001 is the CDN path (wall clock, ESPN line); 0021600001 the stats.nba.com path (no
 * wall clock, the model's line); 0022400144 went to overtime (GSW 127 at HOU 121, 2024-11-02);
 * 0022400718 is Darius Garland's 31-footer at 0.0 (CLE 118 at DET 115, 2025-02-05) and
 * 0022400807 Nic Claxton's tip at the horn (BKN 105 at PHI 103, 2025-02-22).
 */
const NBA = ['0022400001', '0021600001', '0022400144', '0022400718', '0022400807'];
const NBA_OVERTIME = new Set(['0022400144']);
const NBA_BUZZER = new Set(['0022400718', '0022400807']);
/**
 * MLS, story vs the scoreboard's details[] (goals, cards and the shootout flag), an endpoint the
 * story never reads: it is built from the summary's keyEvents. 655997 is the 2022 MLS Cup (3-3,
 * extra time, a red card, LAFC 3-0 on penalties); 761829 Inter Miami 2-2 San Diego (2026-09-20,
 * Dean's match); 692761 a 3-2 away win; 726902 a 6-1 rout; 693055 a 3-2 home win.
 */
const MLS = ['655997', '761829', '692761', '726902', '693055'];
const MLS_SHOOTOUT = new Set(['655997']);
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

async function checkNba(
  db: ReturnType<typeof createDb>,
  nba: NbaClient,
  id: string,
): Promise<void> {
  const { data, error } = await db
    .from('games')
    .select(
      'id, home_score, away_score, innings_or_periods, scheduled_start, home:home_team_id(name), away:away_team_id(name)',
    )
    .eq('provider', 'nba')
    .eq('provider_game_id', id);
  if (error) throw new Error(error.message);
  const g = (data ?? [])[0] as
    | {
        id: string;
        home_score: number;
        away_score: number;
        innings_or_periods: number | null;
        scheduled_start: string;
        home: { name: string };
        away: { name: string };
      }
    | undefined;
  if (!g) return fail(id, 'not in the database');
  console.log(
    `${id} ${g.away.name} ${g.away_score}, ${g.home.name} ${g.home_score} (${g.innings_or_periods ?? '?'} periods)`,
  );

  // ESPN's play list, found by date and nicknames: a provider the story was not built from.
  const etDate = easternDateOf(g.scheduled_start);
  const month = await nba.espnScoreboardMonth(etDate.slice(0, 7).replace('-', ''));
  const key = espnKey(etDate, g.home.name, g.away.name);
  const event = parseEspnScoreboard(month.events ?? []).find(
    (i) => `${i.etDate}|${i.homeNick}|${i.awayNick}` === key,
  );
  if (!event) return fail(id, 'ESPN has no event for it');
  const summary = await nba.espnSummary(event.eventId);
  const scoring = (summary.plays ?? []).filter((p) => p.scoringPlay);
  const espnStates = dedupe(scoring.map((p) => `${p.awayScore}-${p.homeScore}`));
  const espnSet = new Set(espnStates);
  // Two providers can order plays at the same clock differently (a double technical: the
  // CDN scores one shooter's free throws first, ESPN the other's). Any state reachable by
  // some ordering of the plays at one clock is accepted: the subset sums of their increments.
  let prevAway = 0;
  let prevHome = 0;
  let i = 0;
  while (i < scoring.length) {
    const p = scoring[i]!;
    const key = `${p.period?.number}|${p.clock?.displayValue}`;
    const group: { da: number; dh: number }[] = [];
    let a = prevAway;
    let h = prevHome;
    let j = i;
    while (
      j < scoring.length &&
      `${scoring[j]!.period?.number}|${scoring[j]!.clock?.displayValue}` === key
    ) {
      const q = scoring[j]!;
      group.push({ da: (q.awayScore ?? 0) - a, dh: (q.homeScore ?? 0) - h });
      a = q.awayScore ?? 0;
      h = q.homeScore ?? 0;
      j++;
    }
    if (group.length > 1) {
      for (let mask = 1; mask < 1 << group.length; mask++) {
        let sa = prevAway;
        let sh = prevHome;
        group.forEach((inc, k) => {
          if (mask & (1 << k)) {
            sa += inc.da;
            sh += inc.dh;
          }
        });
        espnSet.add(`${sa}-${sh}`);
      }
    }
    prevAway = a;
    prevHome = h;
    i = j;
  }

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
  const rows = ((
    await db
      .from('game_scoring_timeline')
      .select('seq, period, clock, away_score, home_score')
      .eq('game_id', g.id)
      .order('seq')
  ).data ?? []) as {
    seq: number;
    period: number;
    clock: string | null;
    away_score: number;
    home_score: number;
  }[];
  const wp = ((
    await db.from('game_wp_timeline').select('seq, home_wp').eq('game_id', g.id).order('seq')
  ).data ?? []) as { seq: number; home_wp: number }[];
  const events = ((await db.from('game_events').select('type').eq('game_id', g.id)).data ?? []) as {
    type: string;
  }[];
  if (steps.length === 0) return fail(id, 'no story; run ingest/src/nba/relive.ts --game first');

  const story = steps.slice(1, -1).map((s) => `${s.away_score}-${s.home_score}`);
  const invented = story.filter((s) => !espnSet.has(s));
  if (invented.length) fail(id, `scores ESPN never saw: ${invented.join(' ')}`);
  const late = rows.filter(
    (r) => r.period >= 5 || (r.period === 4 && (clockToSeconds(r.clock) ?? 999) <= 180),
  );
  const shown = new Set(story);
  const missingLate = late.filter((r) => !shown.has(`${r.away_score}-${r.home_score}`));
  if (missingLate.length)
    fail(
      id,
      `late scores not shown: ${missingLate.map((r) => `${r.away_score}-${r.home_score}`).join(' ')}`,
    );
  if (story.at(-1) !== `${g.away_score}-${g.home_score}`)
    fail(id, `last scoring step ${story.at(-1)} is not the final`);
  if (espnStates.at(-1) !== `${g.away_score}-${g.home_score}`)
    fail(id, `ESPN's final ${espnStates.at(-1)} differs from ours`);
  const seqs = new Set(wp.map((p) => p.seq));
  if (!steps.every((s) => seqs.has(s.wp_seq))) fail(id, 'a step points at no probability point');
  const end = Number(wp.at(-1)?.home_wp);
  const homeWon = g.home_score > g.away_score;
  if (homeWon ? end < 0.9 : end > 0.1)
    fail(id, `the line ends at ${end} but the ${homeWon ? 'home' : 'away'} team won`);
  if (NBA_OVERTIME.has(id)) {
    if (!steps.some((s) => /overtime/i.test(s.label)))
      fail(id, 'overtime, and no step is labelled with it');
    if (!events.some((e) => e.type === 'overtime')) fail(id, 'overtime, and no overtime moment');
  }
  if (NBA_BUZZER.has(id) && !events.some((e) => e.type === 'buzzer_beater'))
    fail(id, 'a buzzer-beater, and no buzzer_beater moment');
  console.log(
    `  ${wp.length} points, ${steps.length} steps, ${story.length} of ${espnStates.length} ESPN states shown, ${events.map((e) => e.type).join(', ') || 'no moments'}`,
  );
}

type MlsDetail = {
  type?: { text?: string };
  clock?: { displayValue?: string };
  team?: { id?: string };
  scoringPlay?: boolean;
  redCard?: boolean;
  shootout?: boolean;
  athletesInvolved?: { displayName?: string }[];
};

async function checkMls(db: ReturnType<typeof createDb>, id: string): Promise<void> {
  const g = (
    await db
      .from('games')
      .select(
        'id, scheduled_start, home_score, away_score, decision_method, home_shootout_score, away_shootout_score, winner_team_id, home_team_id, home:home_team_id(name, provider_team_id), away:away_team_id(name, provider_team_id)',
      )
      .eq('provider', 'espn_mls')
      .eq('provider_game_id', id)
      .maybeSingle()
  ).data as {
    id: string;
    scheduled_start: string;
    home_score: number;
    away_score: number;
    decision_method: string | null;
    home_shootout_score: number | null;
    away_shootout_score: number | null;
    winner_team_id: string | null;
    home_team_id: string;
    home: { name: string; provider_team_id: string };
    away: { name: string; provider_team_id: string };
  } | null;
  if (!g) return fail(id, 'not in games');
  console.log(`${id} ${g.away.name} ${g.away_score}, ${g.home.name} ${g.home_score} (${g.decision_method})`);

  // The independent source: the month's scoreboard, details[] of this event.
  const provider = mlsProvider();
  const start = new Date(g.scheduled_start);
  let event = (await provider.month(start.getUTCFullYear(), start.getUTCMonth() + 1)).events.find(
    (e) => e.id === id,
  );
  if (!event) {
    const prev = new Date(start.getTime() - 3 * 86_400_000);
    event = (await provider.month(prev.getUTCFullYear(), prev.getUTCMonth() + 1)).events.find(
      (e) => e.id === id,
    );
  }
  if (!event) return fail(id, 'not on the scoreboard');
  const details = ((event.competitions[0] as { details?: MlsDetail[] }).details ?? []).filter(
    (d) => !d.shootout,
  );
  let a = 0;
  let h = 0;
  const truth: string[] = [];
  const scorers: string[] = [];
  for (const d of details) {
    if (!d.scoringPlay) continue;
    if (d.team?.id === g.home.provider_team_id) h++;
    else a++;
    truth.push(`${a}-${h}`);
    scorers.push(d.athletesInvolved?.[0]?.displayName ?? '?');
  }
  const redCards = details.filter((d) => d.redCard).length;

  const steps = ((
    await db
      .from('game_story_steps')
      .select('seq, wp_seq, away_score, home_score, label, kind, text')
      .eq('game_id', g.id)
      .order('seq')
  ).data ?? []) as {
    seq: number;
    wp_seq: number;
    away_score: number;
    home_score: number;
    label: string;
    kind: string | null;
    text: string;
  }[];
  const rows = ((
    await db
      .from('game_scoring_timeline')
      .select('seq, away_score, home_score, scorer_name')
      .eq('game_id', g.id)
      .order('seq')
  ).data ?? []) as { seq: number; away_score: number; home_score: number; scorer_name: string | null }[];
  const wp = ((
    await db.from('game_wp_timeline').select('seq, home_wp').eq('game_id', g.id).order('seq')
  ).data ?? []) as { seq: number; home_wp: number }[];
  const events = ((await db.from('game_events').select('type').eq('game_id', g.id)).data ?? []) as {
    type: string;
  }[];
  if (steps.length === 0) return fail(id, 'no story; run ingest/src/mls/detail.ts --events first');

  const story = steps.filter((s) => s.kind).map((s) => `${s.away_score}-${s.home_score}`);
  if (story.join(' ') !== truth.join(' '))
    fail(id, `goals differ\n    story      ${story.join(' ')}\n    scoreboard ${truth.join(' ')}`);
  const timeline = rows.map((r) => `${r.away_score}-${r.home_score}`);
  if (timeline.join(' ') !== truth.join(' '))
    fail(id, `timeline differs\n    timeline   ${timeline.join(' ')}\n    scoreboard ${truth.join(' ')}`);
  const named = rows.map((r) => r.scorer_name ?? '?');
  if (named.join('|') !== scorers.join('|'))
    fail(id, `scorers differ\n    timeline   ${named.join(', ')}\n    scoreboard ${scorers.join(', ')}`);
  if ((story.at(-1) ?? '0-0') !== `${g.away_score}-${g.home_score}`)
    fail(id, `last goal step ${story.at(-1)} is not the final`);
  const seqs = new Set(wp.map((p) => p.seq));
  if (!steps.every((s) => seqs.has(s.wp_seq))) fail(id, 'a step points at no probability point');
  const end = Number(wp.at(-1)?.home_wp);
  const homeWon = g.winner_team_id === g.home_team_id;
  if (end !== (homeWon ? 1 : 0))
    fail(id, `the line ends at ${end} but the home side ${homeWon ? 'won' : 'did not win'}`);
  const cardSteps = steps.filter((s) => /red card|second yellow/i.test(s.text)).length;
  if (cardSteps !== redCards) fail(id, `${redCards} red card(s) on the scoreboard, ${cardSteps} in the story`);
  if (redCards > 0 && !events.some((e) => e.type === 'red_card')) fail(id, 'a red card, and no red_card moment');
  if (MLS_SHOOTOUT.has(id)) {
    if (!steps.some((s) => s.label === 'Penalties')) fail(id, 'a shootout, and no Penalties step');
    if (!events.some((e) => e.type === 'shootout')) fail(id, 'a shootout, and no shootout moment');
    const last = steps.at(-1)!.text;
    const line = `${g.home_shootout_score}-${g.away_shootout_score}`;
    if (!last.includes(line)) fail(id, `the last step does not carry the shootout score ${line}: ${last}`);
  }
  console.log(
    `  ${wp.length} points, ${steps.length} steps, ${truth.length} goals matched by score and scorer, ${events.map((e) => e.type).join(', ') || 'no moments'}`,
  );
}

async function main() {
  const client = new MlbClient();
  console.log('MLB, story vs the game feed');
  for (const pk of MLB) await checkMlb(client, pk);
  console.log('\nNFL, story vs game_scoring_timeline');
  const db = createDb();
  for (const id of NFL) await checkNfl(db, id);
  console.log("\nNBA, story vs ESPN's play list");
  const nba = new NbaClient({ cache: diskCache() });
  for (const id of NBA) await checkNba(db, nba, id);
  console.log("\nMLS, story vs the scoreboard's details");
  for (const id of MLS) await checkMls(db, id);
  console.log(
    problems.length === 0 ? '\nall 20 games check out' : `\n${problems.length} problem(s)`,
  );
  process.exit(problems.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
