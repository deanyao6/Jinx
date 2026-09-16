import { describe, expect, it } from 'vitest';

import {
  ELO_PARAMS,
  homeWinProbability,
  movMultiplier,
  regressForNewSeason,
  runElo,
  type EloGameInput,
} from './elo.js';

function game(partial: Partial<EloGameInput> & { id: string }): EloGameInput {
  return {
    season: 2024,
    scheduledStart: '2024-04-01T00:00:00Z',
    homeTeamId: 'A',
    awayTeamId: 'B',
    homeScore: null,
    awayScore: null,
    isNeutralSite: false,
    ...partial,
  };
}

describe('homeWinProbability', () => {
  it('is 0.5 for equal teams with no home advantage', () => {
    expect(homeWinProbability(1500, 1500, 0)).toBeCloseTo(0.5, 10);
  });
  it('favors the home team with home advantage', () => {
    expect(homeWinProbability(1500, 1500, 24)).toBeGreaterThan(0.5);
    expect(homeWinProbability(1500, 1500, 48)).toBeGreaterThan(homeWinProbability(1500, 1500, 24));
  });
  it('is symmetric', () => {
    const p = homeWinProbability(1600, 1450, 0);
    expect(p + homeWinProbability(1450, 1600, 0)).toBeCloseTo(1, 10);
  });
});

describe('runElo', () => {
  it('produces a frozen pregame probability for every game, final or not', () => {
    const run = runElo(
      [
        game({ id: 'g1', homeScore: 5, awayScore: 3 }),
        game({ id: 'g2', scheduledStart: '2024-04-02T00:00:00Z' }),
      ],
      ELO_PARAMS.mlb,
    );
    expect(run.results.map((r) => r.id)).toEqual(['g1', 'g2']);
    expect(run.results[0]?.homeWinProb).toBeCloseTo(homeWinProbability(1500, 1500, 24), 10);
    // g1 home win moved A up, so A's next pregame probability is higher
    expect(run.results[1]?.homeWinProb).toBeGreaterThan(run.results[0]?.homeWinProb ?? 0);
  });

  it('uses no home advantage at neutral sites', () => {
    const run = runElo([game({ id: 'n', isNeutralSite: true })], ELO_PARAMS.nfl);
    expect(run.results[0]?.homeWinProb).toBeCloseTo(0.5, 10);
  });

  it('applies a margin-of-victory multiplier for NFL only', () => {
    const blowout = [game({ id: 'x', homeScore: 45, awayScore: 3 })];
    const close = [game({ id: 'x', homeScore: 21, awayScore: 20 })];
    const nflBlow = runElo(blowout, ELO_PARAMS.nfl).ratings.get('A') ?? 0;
    const nflClose = runElo(close, ELO_PARAMS.nfl).ratings.get('A') ?? 0;
    expect(nflBlow).toBeGreaterThan(nflClose);
    const mlbBlow =
      runElo([game({ id: 'x', homeScore: 15, awayScore: 0 })], ELO_PARAMS.mlb).ratings.get('A') ??
      0;
    const mlbClose =
      runElo([game({ id: 'x', homeScore: 2, awayScore: 1 })], ELO_PARAMS.mlb).ratings.get('A') ?? 0;
    expect(mlbBlow).toBeCloseTo(mlbClose, 10);
  });

  it('treats ties as half a win', () => {
    const run = runElo(
      [game({ id: 't', homeScore: 20, awayScore: 20, isNeutralSite: true })],
      ELO_PARAMS.nfl,
    );
    expect(run.ratings.get('A')).toBeCloseTo(1505, 6);
    expect(run.ratings.get('B')).toBeCloseTo(1505, 6);
  });

  it('regresses toward the base at a new season', () => {
    expect(regressForNewSeason(1600, ELO_PARAMS.mlb)).toBeCloseTo(1600 - 100 / 3, 10);
    const run = runElo(
      [
        game({
          id: 'a',
          season: 2023,
          scheduledStart: '2023-06-01T00:00:00Z',
          homeScore: 10,
          awayScore: 0,
        }),
        game({ id: 'b', season: 2024, scheduledStart: '2024-06-01T00:00:00Z' }),
      ],
      ELO_PARAMS.mlb,
    );
    const afterA = 1500 + 4 * (1 - homeWinProbability(1500, 1500, 24));
    expect(run.results[1]?.homeEloPre).toBeCloseTo(regressForNewSeason(afterA, ELO_PARAMS.mlb), 8);
  });

  it('reports log loss only over games with enough history', () => {
    const games: EloGameInput[] = [];
    for (let i = 0; i < 30; i++) {
      games.push(
        game({
          id: `g${i}`,
          scheduledStart: `2024-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
          homeScore: 3,
          awayScore: 1,
        }),
      );
    }
    const run = runElo(games, ELO_PARAMS.mlb, { minPriorGames: 20 });
    expect(run.scoredGames).toBe(10);
    expect(run.logLoss).not.toBeNull();
    expect(run.logLoss ?? 1).toBeLessThan(Math.log(2));
  });

  it('mov multiplier grows with margin and shrinks for expected blowouts', () => {
    expect(movMultiplier(20, 0)).toBeGreaterThan(movMultiplier(3, 0));
    expect(movMultiplier(20, 200)).toBeLessThan(movMultiplier(20, 0));
  });
});
