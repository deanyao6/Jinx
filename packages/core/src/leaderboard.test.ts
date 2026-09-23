import { describe, expect, it } from 'vitest';

import { pageLeaderboard, rankLeaderboard, statsForCommunity } from './leaderboard.js';

describe('rankLeaderboard', () => {
  it('ranks descending by value', () => {
    const ranked = rankLeaderboard([
      { userId: 'a', value: 12, achievedAt: '2027-05-01T00:00:00Z' },
      { userId: 'b', value: 40, achievedAt: '2027-05-01T00:00:00Z' },
      { userId: 'c', value: 25, achievedAt: '2027-05-01T00:00:00Z' },
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(['b', 'c', 'a']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('breaks ties by who got there first', () => {
    const ranked = rankLeaderboard([
      { userId: 'late', value: 10, achievedAt: '2027-06-01T00:00:00Z' },
      { userId: 'early', value: 10, achievedAt: '2027-01-01T00:00:00Z' },
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(['early', 'late']);
    expect(ranked[0]!.rank).toBe(1);
    expect(ranked[1]!.rank).toBe(2);
  });
});

describe('pageLeaderboard', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    userId: `u${i}`,
    value: 100 - i,
    achievedAt: '2027-01-01T00:00:00Z',
  }));

  it('pins the viewer at the bottom when off-page', () => {
    const page = pageLeaderboard(rows, 'u8', 5);
    expect(page.rows).toHaveLength(5);
    expect(page.rows.some((r) => r.userId === 'u8')).toBe(false);
    expect(page.viewer).toMatchObject({ userId: 'u8', rank: 9, pinned: true });
  });

  it('marks the viewer not pinned when already on the visible page', () => {
    const page = pageLeaderboard(rows, 'u2', 5);
    expect(page.viewer).toMatchObject({ userId: 'u2', pinned: false });
  });

  it('viewer is null when not ranked at all', () => {
    expect(pageLeaderboard(rows, 'ghost', 5).viewer).toBeNull();
  });
});

describe('statsForCommunity', () => {
  it('venue communities only offer venue_games, not the venue-agnostic twins', () => {
    const keys = statsForCommunity('venue', 'mlb').map((s) => s.key);
    expect(keys).toContain('venue_games');
    expect(keys).not.toContain('stadiums');
    expect(keys).not.toContain('games');
    expect(keys).not.toContain('wins');
  });

  it('team communities get the sport-specific stats and not other sports', () => {
    const keys = statsForCommunity('team', 'mlb').map((s) => s.key);
    expect(keys).toContain('mlb_home_runs');
    expect(keys).not.toContain('nfl_touchdowns');
  });

  it('school communities get the venue-agnostic stadiums stat', () => {
    const keys = statsForCommunity('school', null).map((s) => s.key);
    expect(keys).toContain('stadiums');
  });
});
