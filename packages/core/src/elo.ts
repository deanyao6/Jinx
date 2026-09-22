/**
 * Elo v1 win probabilities (SPEC.md 6.6). One system per sport, processed chronologically.
 *
 * Parameters (documented here per the spec; tune with `ingest` backtest script and record results in
 * docs/elo-backtest.md):
 *   MLB: K = 4,  home_adv = 24, regress 1/3 toward 1500 at each new season.
 *   NFL: K = 20, home_adv = 48, regress 1/3 toward 1505 at each new season, margin-of-victory multiplier.
 *   NBA: K = 8, home_adv = 50, regress 1/3 toward 1500 at each new season, margin-of-victory
 *        multiplier. The brief's starting point (K = 20, home_adv = 100, 1/4, no multiplier)
 *        scored 0.638 over 2016-2025; a 150-point grid found this at 0.624 (docs/elo-backtest.md).
 *   Neutral-site games use home_adv = 0.
 */
import type { Sport } from './types.js';

export interface EloParams {
  k: number;
  homeAdv: number;
  /** Fraction of the distance to `base` a rating moves at the start of each new season. */
  seasonRegression: number;
  base: number;
  movMultiplier: boolean;
}

// MLS has its own three-outcome model below (THREE_WAY_PARAMS); the binary one never fits a draw.
export const ELO_PARAMS: Record<Exclude<Sport, 'mls'>, EloParams> = {
  mlb: { k: 4, homeAdv: 24, seasonRegression: 1 / 3, base: 1500, movMultiplier: false },
  nfl: { k: 20, homeAdv: 48, seasonRegression: 1 / 3, base: 1505, movMultiplier: true },
  nba: { k: 8, homeAdv: 50, seasonRegression: 1 / 3, base: 1500, movMultiplier: true },
};

export interface EloGameInput {
  id: string;
  season: number;
  /** Sort key; ISO timestamp. */
  scheduledStart: string;
  homeTeamId: string;
  awayTeamId: string;
  /** Null scores mean the game is not final and only a pregame probability is produced. */
  homeScore: number | null;
  awayScore: number | null;
  isNeutralSite: boolean;
}

export interface EloGameResult {
  id: string;
  homeWinProb: number;
  homeEloPre: number;
  awayEloPre: number;
}

export interface EloRun {
  ratings: Map<string, number>;
  results: EloGameResult[];
  /** Mean log loss over final, non-tie games where both teams had at least `minPriorGames` prior games. */
  logLoss: number | null;
  scoredGames: number;
}

/** Pregame home win probability from ratings. */
export function homeWinProbability(eloHome: number, eloAway: number, homeAdv: number): number {
  return 1 / (1 + Math.pow(10, -(eloHome + homeAdv - eloAway) / 400));
}

/** FiveThirtyEight-style margin-of-victory multiplier. */
export function movMultiplier(margin: number, eloDiffWinner: number): number {
  return (Math.log(Math.abs(margin) + 1) * 2.2) / (eloDiffWinner * 0.001 + 2.2);
}

export function regressForNewSeason(rating: number, params: EloParams): number {
  return rating + (params.base - rating) * params.seasonRegression;
}

function actualScore(home: number, away: number): number {
  if (home > away) return 1;
  if (home < away) return 0;
  return 0.5;
}

export interface RunEloOptions {
  minPriorGames?: number;
  /** Seed ratings (e.g. carried over from the database) keyed by team id. */
  initialRatings?: Map<string, number>;
  /** Season of the seed ratings, so the first season boundary regresses correctly. */
  initialSeason?: number;
}

/**
 * Runs Elo chronologically over `games`, returning final ratings and the frozen pregame probability
 * for every game (including non-final ones, whose ratings are simply not updated).
 */
export function runElo(games: EloGameInput[], params: EloParams, opts: RunEloOptions = {}): EloRun {
  const minPrior = opts.minPriorGames ?? 20;
  const ratings = new Map<string, number>(opts.initialRatings ?? []);
  const gamesPlayed = new Map<string, number>();
  const results: EloGameResult[] = [];
  let currentSeason: number | null = opts.initialSeason ?? null;
  let lossSum = 0;
  let scored = 0;

  const sorted = [...games].sort(
    (a, b) => a.scheduledStart.localeCompare(b.scheduledStart) || a.id.localeCompare(b.id),
  );

  for (const g of sorted) {
    if (currentSeason !== null && g.season !== currentSeason) {
      for (const [team, r] of ratings) ratings.set(team, regressForNewSeason(r, params));
    }
    currentSeason = g.season;

    const home = ratings.get(g.homeTeamId) ?? params.base;
    const away = ratings.get(g.awayTeamId) ?? params.base;
    const adv = g.isNeutralSite ? 0 : params.homeAdv;
    const p = homeWinProbability(home, away, adv);
    results.push({ id: g.id, homeWinProb: p, homeEloPre: home, awayEloPre: away });

    if (g.homeScore === null || g.awayScore === null) continue;

    const s = actualScore(g.homeScore, g.awayScore);
    const homePrior = gamesPlayed.get(g.homeTeamId) ?? 0;
    const awayPrior = gamesPlayed.get(g.awayTeamId) ?? 0;
    if (s !== 0.5 && homePrior >= minPrior && awayPrior >= minPrior) {
      const clamped = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
      lossSum -= s === 1 ? Math.log(clamped) : Math.log(1 - clamped);
      scored += 1;
    }

    let k = params.k;
    if (params.movMultiplier && s !== 0.5) {
      const margin = g.homeScore - g.awayScore;
      const eloDiffWinner = s === 1 ? home + adv - away : away - (home + adv);
      k *= movMultiplier(margin, eloDiffWinner);
    }
    const delta = k * (s - p);
    ratings.set(g.homeTeamId, home + delta);
    ratings.set(g.awayTeamId, away - delta);
    gamesPlayed.set(g.homeTeamId, homePrior + 1);
    gamesPlayed.set(g.awayTeamId, awayPrior + 1);
  }

  return { ratings, results, logLoss: scored > 0 ? lossSum / scored : null, scoredGames: scored };
}

// ---------------------------------------------------------------------------
// Three outcomes: Elo with a draw term, for MLS (next-wave E.1, 2026-09-22).
//
// Ratings move as in the binary model, with a draw scoring 0.5 and the margin multiplier on the
// goal difference. The pregame probabilities come from a Davidson term: with
// d = elo_home + home_adv - elo_away and r = 10^(d/400),
//   P(home) = r / (r + 1 + v * sqrt(r)),  P(away) = 1 / (...),  P(draw) = v * sqrt(r) / (...),
// so the draw is likeliest between equals (sqrt(r) = 1) and thins out as the sides diverge.
// `draw` (v) is fitted by grid with the rest (ingest/src/elo/sweep.ts --sport mls), scored by
// three-way log loss; docs/elo-backtest.md has the grid.
// ---------------------------------------------------------------------------

export interface ThreeWayParams extends EloParams {
  /** The Davidson draw parameter: 0 is the binary model, 1 makes a draw as likely as either side's win between equals. */
  draw: number;
}

export const THREE_WAY_PARAMS: Record<'mls', ThreeWayParams> = {
  // Fitted 2026-09-22 on 2016-2025 (docs/elo-backtest.md): three-way log loss 1.0358 over 3,911
  // matches from 2018 against 1.0518 for the base rates; the grid's floor was flat around it.
  mls: { k: 30, homeAdv: 100, seasonRegression: 1 / 3, base: 1500, movMultiplier: true, draw: 0.8 },
};

export interface ThreeWayProbabilities {
  home: number;
  draw: number;
  away: number;
}

export function threeWayProbabilities(
  eloHome: number,
  eloAway: number,
  homeAdv: number,
  draw: number,
): ThreeWayProbabilities {
  const r = Math.pow(10, (eloHome + homeAdv - eloAway) / 400);
  const d = draw * Math.sqrt(r);
  const z = r + 1 + d;
  return { home: r / z, draw: d / z, away: 1 / z };
}

export interface ThreeWayGameResult extends EloGameResult {
  drawProb: number;
  awayWinProb: number;
}

export interface ThreeWayRun {
  ratings: Map<string, number>;
  results: ThreeWayGameResult[];
  /** Mean three-way log loss over final games where both teams had `minPriorGames` prior games. */
  logLoss: number | null;
  scoredGames: number;
}

/** Runs the draw-aware Elo chronologically; the same contract as runElo with a draw probability. */
export function runEloThreeWay(
  games: EloGameInput[],
  params: ThreeWayParams,
  opts: RunEloOptions & { scoreFromSeason?: number } = {},
): ThreeWayRun {
  const minPrior = opts.minPriorGames ?? 20;
  const ratings = new Map<string, number>(opts.initialRatings ?? []);
  const gamesPlayed = new Map<string, number>();
  const results: ThreeWayGameResult[] = [];
  let currentSeason: number | null = opts.initialSeason ?? null;
  let lossSum = 0;
  let scored = 0;

  const sorted = [...games].sort(
    (a, b) => a.scheduledStart.localeCompare(b.scheduledStart) || a.id.localeCompare(b.id),
  );
  for (const g of sorted) {
    if (currentSeason !== null && g.season !== currentSeason) {
      for (const [team, r] of ratings) ratings.set(team, regressForNewSeason(r, params));
    }
    currentSeason = g.season;
    const home = ratings.get(g.homeTeamId) ?? params.base;
    const away = ratings.get(g.awayTeamId) ?? params.base;
    const adv = g.isNeutralSite ? 0 : params.homeAdv;
    const p = threeWayProbabilities(home, away, adv, params.draw);
    results.push({
      id: g.id,
      homeWinProb: p.home,
      drawProb: p.draw,
      awayWinProb: p.away,
      homeEloPre: home,
      awayEloPre: away,
    });
    if (g.homeScore === null || g.awayScore === null) continue;

    const s = actualScore(g.homeScore, g.awayScore);
    const homePrior = gamesPlayed.get(g.homeTeamId) ?? 0;
    const awayPrior = gamesPlayed.get(g.awayTeamId) ?? 0;
    if (
      homePrior >= minPrior &&
      awayPrior >= minPrior &&
      (opts.scoreFromSeason === undefined || g.season >= opts.scoreFromSeason)
    ) {
      const q = s === 1 ? p.home : s === 0 ? p.away : p.draw;
      lossSum -= Math.log(Math.min(Math.max(q, 1e-6), 1));
      scored += 1;
    }
    // The binary expectation of the same ratings drives the update, as in the other sports.
    const expected = homeWinProbability(home, away, adv);
    let k = params.k;
    if (params.movMultiplier && s !== 0.5) {
      const margin = g.homeScore - g.awayScore;
      const eloDiffWinner = s === 1 ? home + adv - away : away - (home + adv);
      k *= movMultiplier(margin, eloDiffWinner);
    }
    const delta = k * (s - expected);
    ratings.set(g.homeTeamId, home + delta);
    ratings.set(g.awayTeamId, away - delta);
    gamesPlayed.set(g.homeTeamId, homePrior + 1);
    gamesPlayed.set(g.awayTeamId, awayPrior + 1);
  }
  return { ratings, results, logLoss: scored > 0 ? lossSum / scored : null, scoredGames: scored };
}
