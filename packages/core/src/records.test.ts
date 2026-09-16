import { describe, expect, it } from 'vitest';

import {
  companionRecord,
  formatRecord,
  formatVsExpected,
  formatWinRate,
  gameResult,
  overallRecord,
  pledgeRecord,
  pledgeVsExpected,
  streaks,
  teamRecord,
  type AttendedGame,
} from './records.js';
import { rootingSide } from './rooting.js';

const PHI = 'phi';
const NYM = 'nym';
const LAR = 'lar';
const STL = 'stl';

function g(partial: Partial<AttendedGame> & { gameId: string }): AttendedGame {
  return {
    status: 'final',
    scheduledStart: '2024-06-01T00:00:00Z',
    homeTeamId: PHI,
    awayTeamId: NYM,
    homeScore: 5,
    awayScore: 3,
    rootingTeamId: PHI,
    rootingBasis: 'favorite',
    ...partial,
  };
}

describe('gameResult', () => {
  it('scores wins, losses and ties from the rooting side', () => {
    expect(gameResult(g({ gameId: '1' }), PHI)).toBe('win');
    expect(gameResult(g({ gameId: '1' }), NYM)).toBe('loss');
    expect(gameResult(g({ gameId: '1', homeScore: 3, awayScore: 3 }), PHI)).toBe('tie');
  });
  it('ignores non-final, neutral, and unscored games', () => {
    expect(gameResult(g({ gameId: '1', status: 'postponed' }), PHI)).toBeNull();
    expect(
      gameResult(g({ gameId: '1', status: 'cancelled', homeScore: null, awayScore: null }), PHI),
    ).toBeNull();
    expect(gameResult(g({ gameId: '1', status: 'live' }), PHI)).toBeNull();
    expect(gameResult(g({ gameId: '1' }), null)).toBeNull();
    expect(gameResult(g({ gameId: '1' }), 'someone-else')).toBeNull();
  });
});

describe('records', () => {
  const games: AttendedGame[] = [
    g({ gameId: 'a', scheduledStart: '2024-04-01T00:00:00Z' }), // PHI win
    g({ gameId: 'b', scheduledStart: '2024-04-02T00:00:00Z', homeScore: 1, awayScore: 4 }), // PHI loss
    g({ gameId: 'c', scheduledStart: '2024-04-03T00:00:00Z', homeScore: 2, awayScore: 2 }), // tie
    g({
      gameId: 'd',
      scheduledStart: '2024-04-04T00:00:00Z',
      status: 'postponed',
      homeScore: null,
      awayScore: null,
    }),
    g({
      gameId: 'e',
      scheduledStart: '2024-04-05T00:00:00Z',
      rootingTeamId: null,
      rootingBasis: null,
    }), // neutral
    g({
      gameId: 'f',
      scheduledStart: '2024-04-06T00:00:00Z',
      homeTeamId: 'chi',
      awayTeamId: 'gb',
      homeScore: 20,
      awayScore: 17,
      rootingTeamId: 'chi',
      rootingBasis: 'pledge',
      pledge: { teamId: 'chi', status: 'valid', winProbAtPledge: 0.38 },
    }),
    g({
      gameId: 'g',
      scheduledStart: '2024-04-07T00:00:00Z',
      homeTeamId: 'chi',
      awayTeamId: 'gb',
      homeScore: 10,
      awayScore: 17,
      rootingTeamId: 'chi',
      rootingBasis: 'pledge',
      pledge: { teamId: 'chi', status: 'valid', winProbAtPledge: 0.6 },
    }),
    g({
      gameId: 'h',
      scheduledStart: '2024-04-08T00:00:00Z',
      homeTeamId: 'chi',
      awayTeamId: 'gb',
      homeScore: 30,
      awayScore: 0,
      rootingTeamId: null,
      rootingBasis: null,
      pledge: { teamId: 'chi', status: 'void', winProbAtPledge: 0.5 },
    }),
  ];

  it('overall record counts every game with a side', () => {
    expect(overallRecord(games)).toEqual({ wins: 2, losses: 2, ties: 1 });
  });
  it('team record filters by the rooted team', () => {
    expect(teamRecord(games, [PHI])).toEqual({ wins: 1, losses: 1, ties: 1 });
    expect(teamRecord(games, ['chi'])).toEqual({ wins: 1, losses: 1, ties: 0 });
  });
  it('pledge record uses only valid pledges', () => {
    expect(pledgeRecord(games)).toEqual({ wins: 1, losses: 1, ties: 0 });
    expect(pledgeVsExpected(games)).toBeCloseTo(1 - 0.38 + (0 - 0.6), 10);
  });
  it('companion record uses the tagging user side', () => {
    expect(companionRecord(games, ['a', 'b', 'e'])).toEqual({ wins: 1, losses: 1, ties: 0 });
  });
  it('formats records, win rate and vs expected', () => {
    expect(formatRecord({ wins: 31, losses: 17, ties: 0 })).toBe('31–17');
    expect(formatRecord({ wins: 31, losses: 17, ties: 1 })).toBe('31–17–1');
    expect(formatWinRate({ wins: 31, losses: 17, ties: 0 })).toBe('.646');
    expect(formatWinRate({ wins: 3, losses: 0, ties: 2 })).toBe('1.000');
    expect(formatWinRate({ wins: 0, losses: 0, ties: 1 })).toBe('—');
    expect(formatVsExpected(2.36)).toBe('+2.4');
    expect(formatVsExpected(-0.62)).toBe('-0.6');
    expect(formatVsExpected(0.04)).toBe('0.0');
  });
  it('computes streaks in chronological order with ties breaking runs', () => {
    expect(streaks(games)).toEqual({ longestWin: 1, longestLoss: 1, current: -1 });
    const wins = [1, 2, 3].map((i) =>
      g({ gameId: `w${i}`, scheduledStart: `2024-05-0${i}T00:00:00Z` }),
    );
    expect(
      streaks([
        ...wins,
        g({ gameId: 'l', scheduledStart: '2024-05-09T00:00:00Z', homeScore: 0, awayScore: 1 }),
      ]),
    ).toEqual({
      longestWin: 3,
      longestLoss: 1,
      current: -1,
    });
  });
});

describe('rootingSide', () => {
  const franchiseOf = (id: string) => (id === STL || id === LAR ? 'nfl-rams' : id);
  it('picks the single favorite', () => {
    expect(
      rootingSide({ homeTeamId: PHI, awayTeamId: NYM, franchiseOf, favoriteFranchiseIds: [PHI] }),
    ).toEqual({ teamId: PHI, basis: 'favorite', needsChoice: false });
    expect(
      rootingSide({ homeTeamId: PHI, awayTeamId: NYM, franchiseOf, favoriteFranchiseIds: [NYM] }),
    ).toEqual({ teamId: NYM, basis: 'favorite', needsChoice: false });
  });
  it('asks when both teams are favorites, then honors the choice', () => {
    expect(
      rootingSide({
        homeTeamId: PHI,
        awayTeamId: NYM,
        franchiseOf,
        favoriteFranchiseIds: [PHI, NYM],
      }),
    ).toEqual({ teamId: null, basis: null, needsChoice: true });
    expect(
      rootingSide({
        homeTeamId: PHI,
        awayTeamId: NYM,
        franchiseOf,
        favoriteFranchiseIds: [PHI, NYM],
        chosenTeamId: NYM,
      }),
    ).toEqual({ teamId: NYM, basis: 'chosen', needsChoice: false });
  });
  it('uses a valid pledge only when neither team is a favorite', () => {
    expect(
      rootingSide({
        homeTeamId: 'chi',
        awayTeamId: 'gb',
        franchiseOf,
        favoriteFranchiseIds: [PHI],
        pledgeTeamId: 'chi',
        pledgeValid: true,
      }),
    ).toEqual({ teamId: 'chi', basis: 'pledge', needsChoice: false });
    expect(
      rootingSide({
        homeTeamId: 'chi',
        awayTeamId: 'gb',
        franchiseOf,
        favoriteFranchiseIds: [PHI],
        pledgeTeamId: 'chi',
        pledgeValid: false,
      }),
    ).toEqual({ teamId: null, basis: null, needsChoice: false });
    expect(
      rootingSide({
        homeTeamId: 'chi',
        awayTeamId: 'gb',
        franchiseOf,
        favoriteFranchiseIds: ['chi'],
        pledgeTeamId: 'gb',
        pledgeValid: true,
      }),
    ).toEqual({ teamId: 'chi', basis: 'favorite', needsChoice: false });
  });
  it('matches relocated franchises', () => {
    expect(
      rootingSide({
        homeTeamId: STL,
        awayTeamId: 'sea',
        franchiseOf,
        favoriteFranchiseIds: ['nfl-rams'],
      }),
    ).toEqual({ teamId: STL, basis: 'favorite', needsChoice: false });
  });
  it('is neutral with no favorites and no pledge', () => {
    expect(
      rootingSide({ homeTeamId: PHI, awayTeamId: NYM, franchiseOf, favoriteFranchiseIds: [] }),
    ).toEqual({ teamId: null, basis: null, needsChoice: false });
  });
});
