/**
 * Elo parameter sweep (docs/elo-backtest.md). One chronological pass per combination from
 * 2000, scored over the seasons from --score-from (default 2016) so the early years warm up.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/elo/sweep.ts --sport nba [--score-from 2016]
 *   npx tsx ingest/src/elo/sweep.ts --sport mls --score-from 2018   # three-way: K, home, draw term, MOV
 *
 * MLS is scored by three-way log loss (home, draw, away), every final counted, draws included;
 * its history starts in 2016 so 2016 and 2017 are the warm-up.
 */
import { runElo, runEloThreeWay, type EloGameInput, type EloParams } from '@jinx/core';

import { createDb, selectAll } from '../db.js';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const sport = arg('sport', 'nba');
const scoreFrom = Number(arg('score-from', '2016'));
const db = createDb();
type Row = {
  id: string;
  season: number;
  scheduled_start: string;
  home_team_id: string;
  away_team_id: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  is_neutral_site: boolean;
};
const rows = await selectAll<Row>(
  db,
  'games',
  'id, season, scheduled_start, home_team_id, away_team_id, status, home_score, away_score, is_neutral_site',
  (q) => q.eq('sport_id', sport).neq('game_type', 'preseason'),
);
const games: EloGameInput[] = rows.map((r) => ({
  id: r.id,
  season: r.season,
  scheduledStart: r.scheduled_start,
  homeTeamId: r.home_team_id,
  awayTeamId: r.away_team_id,
  homeScore: r.status === 'final' ? r.home_score : null,
  awayScore: r.status === 'final' ? r.away_score : null,
  isNeutralSite: r.is_neutral_site,
}));
console.log(games.length, 'games');

function loss(params: EloParams): { logLoss: number; scored: number } {
  const run = runElo(games, params, { minPriorGames: 20 });
  const byId = new Map(run.results.map((r) => [r.id, r.homeWinProb]));
  let sum = 0;
  let n = 0;
  for (const g of games) {
    if (
      g.season < scoreFrom ||
      g.homeScore == null ||
      g.awayScore == null ||
      g.homeScore === g.awayScore
    )
      continue;
    const p = Math.min(Math.max(byId.get(g.id)!, 1e-6), 1 - 1e-6);
    sum -= g.homeScore > g.awayScore ? Math.log(p) : Math.log(1 - p);
    n++;
  }
  return { logLoss: sum / n, scored: n };
}

const base = sport === 'nfl' ? 1505 : 1500;
const results: { line: string; loss: number }[] = [];
if (sport === 'mls') {
  // A reference point: a constant model at the base rates of the scored seasons.
  const scoredFinals = games.filter(
    (g) => g.season >= scoreFrom && g.homeScore != null && g.awayScore != null,
  );
  const n = scoredFinals.length;
  const rate = { home: 0, draw: 0, away: 0 };
  for (const g of scoredFinals) {
    if (g.homeScore! > g.awayScore!) rate.home++;
    else if (g.homeScore! < g.awayScore!) rate.away++;
    else rate.draw++;
  }
  const constant =
    -(rate.home * Math.log(rate.home / n) + rate.draw * Math.log(rate.draw / n) + rate.away * Math.log(rate.away / n)) / n;
  console.log(
    `constant model: home ${(rate.home / n).toFixed(3)}, draw ${(rate.draw / n).toFixed(3)}, away ${(rate.away / n).toFixed(3)} over ${n}: ${constant.toFixed(4)}`,
  );
  for (const k of [10, 15, 20, 25, 30, 40])
    for (const homeAdv of [40, 60, 80, 100, 120])
      for (const draw of [0.6, 0.8, 0.9, 1.0, 1.1, 1.2])
        for (const reg of [1 / 4, 1 / 3])
          for (const mov of [false, true]) {
            const run = runEloThreeWay(
              games,
              { k, homeAdv, seasonRegression: reg, base, movMultiplier: mov, draw },
              { minPriorGames: 20, scoreFromSeason: scoreFrom },
            );
            results.push({
              line: `K=${k} home=${homeAdv} draw=${draw} reg=${reg.toFixed(3)} mov=${mov}: ${run.logLoss!.toFixed(4)} over ${run.scoredGames}`,
              loss: run.logLoss!,
            });
          }
  results.sort((a, b) => a.loss - b.loss);
  console.log(results.slice(0, 25).map((r) => r.line).join('\n'));
  console.log('...');
  console.log(results.slice(-3).map((r) => r.line).join('\n'));
  process.exit(0);
}
for (const k of [6, 8, 10, 12, 14, 16, 20, 24, 28])
  for (const homeAdv of [30, 40, 50, 60, 70, 80, 100, 120])
    for (const reg of [1 / 4, 1 / 3])
      for (const mov of [false, true]) {
        const r = loss({ k, homeAdv, seasonRegression: reg, base, movMultiplier: mov });
        results.push({
          line: `K=${k} home=${homeAdv} reg=${reg.toFixed(3)} mov=${mov}: ${r.logLoss.toFixed(4)} over ${r.scored}`,
          loss: r.logLoss,
        });
      }
results.sort((a, b) => a.loss - b.loss);
console.log(results.map((r) => r.line).join('\n'));
