import { describe, expect, it } from 'vitest';

import { computeSeasonStreak, isStreakAtRisk, streakFloorLabel, streakPatchLabel } from './streaks.js';

const seasons = (games: number[], from = 2021) =>
  games.map((g, i) => ({ season: from + i, games: g }));

describe('computeSeasonStreak', () => {
  it('[3,4,2,5,7,4] is 6 seasons, never fewer than 2', () => {
    const streak = computeSeasonStreak(seasons([3, 4, 2, 5, 7, 4]), 2026, true);
    expect(streak).toEqual({
      startSeason: 2021,
      endSeason: 2026,
      seasons: 6,
      minGames: 2,
      isActive: true,
    });
  });

  it('a zero season breaks it: only the run after the gap counts', () => {
    const streak = computeSeasonStreak(seasons([3, 4, 0, 5, 7, 4]), 2026, true);
    expect(streak).toEqual({
      startSeason: 2024,
      endSeason: 2026,
      seasons: 3,
      minGames: 4,
      isActive: true,
    });
  });

  it('a postseason-only season still counts as attended', () => {
    // A season with a single postseason game arrives as games: 1, same as any other.
    const streak = computeSeasonStreak(seasons([2, 1]), 2022, true);
    expect(streak?.seasons).toBe(2);
    expect(streak?.minGames).toBe(1);
  });

  it('an in-progress current season with zero games so far keeps the streak active', () => {
    const streak = computeSeasonStreak(seasons([3, 4]), 2023, false);
    expect(streak?.endSeason).toBe(2022);
    expect(streak?.isActive).toBe(true);
  });

  it('a current season that has ended with zero games breaks the streak', () => {
    const streak = computeSeasonStreak(seasons([3, 4]), 2023, true);
    expect(streak?.endSeason).toBe(2022);
    expect(streak?.isActive).toBe(false);
  });

  it('an attended current season is active regardless of whether it ended', () => {
    const streak = computeSeasonStreak(seasons([3, 4]), 2022, true);
    expect(streak?.isActive).toBe(true);
  });

  it('no attended seasons returns null', () => {
    expect(computeSeasonStreak([], 2026, true)).toBeNull();
    expect(computeSeasonStreak([{ season: 2020, games: 0 }], 2026, true)).toBeNull();
  });
});

describe('copy', () => {
  it('patch and floor labels', () => {
    const streak = computeSeasonStreak(seasons([3, 4, 2, 5, 7, 4]), 2026, true)!;
    expect(streakPatchLabel('Phillies', streak)).toBe('6-season Phillies streak');
    expect(streakFloorLabel(streak)).toBe('never fewer than 2 games');
    expect(streakFloorLabel({ ...streak, minGames: 1 })).toBe('never fewer than 1 game');
  });
});

describe('isStreakAtRisk', () => {
  const base = computeSeasonStreak(seasons([3, 4]), 2023, false)!; // ends 2022, active

  it('is at risk with 10 or fewer games left and no games this season', () => {
    expect(isStreakAtRisk(base, 2023, false, 8)).toBe(true);
    expect(isStreakAtRisk(base, 2023, false, 10)).toBe(true);
  });

  it('is not at risk with more than 10 games left', () => {
    expect(isStreakAtRisk(base, 2023, false, 11)).toBe(false);
  });

  it('is never at risk once the season has ended (it is either active or broken)', () => {
    expect(isStreakAtRisk(base, 2023, true, 0)).toBe(false);
  });

  it('is not at risk when the streak already includes the current season', () => {
    const active = computeSeasonStreak(seasons([3, 4]), 2022, false)!;
    expect(isStreakAtRisk(active, 2022, false, 0)).toBe(false);
  });
});
