/**
 * Elo v1 win probabilities (SPEC.md 6.6). One system per sport, processed chronologically.
 *
 * Parameters (documented here per the spec; tune with `ingest` backtest script and record results in
 * docs/elo-backtest.md):
 *   MLB: K = 4,  home_adv = 24, regress 1/3 toward 1500 at each new season.
 *   NFL: K = 20, home_adv = 48, regress 1/3 toward 1505 at each new season, margin-of-victory multiplier.
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

export const ELO_PARAMS: Record<Sport, EloParams> = {
  mlb: { k: 4, homeAdv: 24, seasonRegression: 1 / 3, base: 1500, movMultiplier: false },
  nfl: { k: 20, homeAdv: 48, seasonRegression: 1 / 3, base: 1505, movMultiplier: true },
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
