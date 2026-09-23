import { describe, expect, it } from 'vitest';

import { compatibility, compatibilitySentence, type CompatibilityInput } from './compatibility.js';

const base: CompatibilityInput = {
  teamsA: 0,
  teamsB: 0,
  sharedTeams: 0,
  venuesA: 0,
  venuesB: 0,
  sharedVenues: 0,
  sharedGames: 0,
  underdogRateA: null,
  underdogRateB: null,
};

// The same four examples are checked against the SQL twin in supabase/tests/074_compatibility.test.sql.
describe('compatibility', () => {
  it('is zero with nothing in common', () => {
    expect(compatibility(base)).toEqual({ score: 0, driver: 'none', driverCount: 0 });
  });

  it('example A: two Phillies fans with six stadiums in common', () => {
    const r = compatibility({
      ...base,
      teamsA: 2,
      teamsB: 1,
      sharedTeams: 1,
      venuesA: 14,
      venuesB: 8,
      sharedVenues: 6,
      sharedGames: 2,
    });
    // teams 1/2 * 30 = 15, venues 6/10 * 30 = 18, games (1 - e^-2/3) * 25 = 12.16; 45.16 / 85.
    expect(r).toEqual({ score: 53, driver: 'venues', driverCount: 6 });
  });

  it('example B: the neutral picks count when both have made three', () => {
    const r = compatibility({
      ...base,
      teamsA: 1,
      teamsB: 1,
      sharedTeams: 0,
      venuesA: 3,
      venuesB: 3,
      sharedVenues: 1,
      sharedGames: 0,
      underdogRateA: 0.6,
      underdogRateB: 0.5,
    });
    // venues 1/5 * 30 = 6, picks 0.9 * 15 = 13.5; 19.5 / 100.
    expect(r).toEqual({ score: 20, driver: 'picks', driverCount: 0 });
  });

  it('example C: identical fans who went to everything together', () => {
    const r = compatibility({
      ...base,
      teamsA: 2,
      teamsB: 2,
      sharedTeams: 2,
      venuesA: 5,
      venuesB: 5,
      sharedVenues: 5,
      sharedGames: 12,
      underdogRateA: 0.25,
      underdogRateB: 0.25,
    });
    // 30 + 30 * 5/7 + 25 * (1 - e^-4) + 15 = 30 + 21.43 + 24.54 + 15 = 90.97.
    expect(r).toEqual({ score: 91, driver: 'teams', driverCount: 2 });
  });

  it('example D: games together outweigh one shared team', () => {
    const r = compatibility({
      ...base,
      teamsA: 3,
      teamsB: 3,
      sharedTeams: 1,
      venuesA: 1,
      venuesB: 20,
      sharedVenues: 1,
      sharedGames: 9,
    });
    // teams 1/5 * 30 = 6, venues 1/3 * 30 = 10, games (1 - e^-3) * 25 = 23.76; 39.76 / 85.
    expect(r).toEqual({ score: 47, driver: 'games', driverCount: 9 });
  });

  it('says the driver in a sentence', () => {
    expect(compatibilitySentence('venues', 6)).toBe('You have 6 stadiums in common.');
    expect(compatibilitySentence('venues', 1)).toBe('You have 1 stadium in common.');
    expect(compatibilitySentence('teams', 1)).toBe('You share a favorite team.');
    expect(compatibilitySentence('games', 4)).toBe('You were at 4 of the same games.');
    expect(compatibilitySentence('none', 0)).toBe('You have not crossed paths yet.');
  });
});
