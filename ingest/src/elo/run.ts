/**
 * Compute Elo ratings and frozen pregame win probabilities (SPEC.md 6.6).
 *
 *   npx tsx ingest/src/elo/run.ts --sport mlb [--backtest-only]
 *
 * - Runs chronologically over every game of the sport from the database.
 * - Writes team_elo (rating as of today) and game_win_prob for games that have not started
 *   (existing rows for games already started are never overwritten: probabilities are frozen).
 * - Prints backtest log loss over final games, which is the number to record in docs/elo-backtest.md.
 */
import {
  ELO_PARAMS,
  THREE_WAY_PARAMS,
  runElo,
  runEloThreeWay,
  type EloGameInput,
  type Sport,
} from '@jinx/core';

import { createDb, selectAll, upsertRows } from '../db.js';

interface GameRow {
  id: string;
  season: number;
  scheduled_start: string;
  home_team_id: string;
  away_team_id: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  is_neutral_site: boolean;
  game_type: string;
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : null;
}

export async function computeElo(sport: Sport, opts: { write: boolean }): Promise<void> {
  const db = createDb();
  const rows = await selectAll<GameRow>(
    db,
    'games',
    'id, season, scheduled_start, home_team_id, away_team_id, status, home_score, away_score, is_neutral_site, game_type',
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
  // MLS: the three-outcome model (draws), scored three ways; the others: the binary one.
  const params = sport === 'mls' ? THREE_WAY_PARAMS.mls : ELO_PARAMS[sport];
  const run =
    sport === 'mls'
      ? runEloThreeWay(games, THREE_WAY_PARAMS.mls, { scoreFromSeason: 2018 })
      : runElo(games, ELO_PARAMS[sport]);
  const drawNote = sport === 'mls' ? `, draw=${THREE_WAY_PARAMS.mls.draw}` : '';
  console.log(
    `${sport}: ${games.length} games, ${run.scoredGames} scored; log loss ${run.logLoss?.toFixed(4) ?? 'n/a'} (K=${params.k}, home_adv=${params.homeAdv}, regression=${params.seasonRegression.toFixed(3)}${drawNote})`,
  );
  if (!opts.write) return;

  const today = new Date().toISOString().slice(0, 10);
  await upsertRows(
    db,
    'team_elo',
    [...run.ratings].map(([team_id, rating]) => ({
      team_id,
      as_of: today,
      rating: Number(rating.toFixed(3)),
    })),
    'team_id,as_of',
  );

  const now = Date.now();
  const notStarted = new Set(
    rows.filter((r) => Date.parse(r.scheduled_start) > now).map((r) => r.id),
  );
  const probRows = run.results.map((r) => ({
    game_id: r.id,
    home_win_prob: Number(r.homeWinProb.toFixed(5)),
    // MLS carries the draw too; the away probability is what is left.
    draw_prob:
      'drawProb' in r && typeof r.drawProb === 'number' ? Number(r.drawProb.toFixed(5)) : null,
    method: sport === 'mls' ? 'elo_draw_v1' : 'elo_v1',
    computed_at: new Date().toISOString(),
  }));
  // Games not yet started: refresh. Games already started: insert only if missing (frozen).
  await upsertRows(
    db,
    'game_win_prob',
    probRows.filter((p) => notStarted.has(p.game_id)),
    'game_id',
  );
  await upsertRows(
    db,
    'game_win_prob',
    probRows.filter((p) => !notStarted.has(p.game_id)),
    'game_id',
    { ignoreDuplicates: true },
  );
  console.log(
    `${sport}: wrote ${run.ratings.size} ratings and ${probRows.length} win probabilities`,
  );
}

if (process.argv[1] && process.argv[1].endsWith('run.ts')) {
  const sport = (arg('sport') ?? 'mlb') as Sport;
  computeElo(sport, { write: !process.argv.includes('--backtest-only') }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
