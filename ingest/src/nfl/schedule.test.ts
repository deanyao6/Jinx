import type { NflverseGameRow } from '@jinx/core';
import { describe, expect, it } from 'vitest';

import { approxFinalAt, groupBySeason, scheduleGame } from './schedule.js';

const played: NflverseGameRow = {
  game_id: '2024_10_DET_HOU',
  season: 2024,
  game_type: 'REG',
  week: 10,
  gameday: '2024-11-10',
  gametime: '20:20',
  away_team: 'DET',
  away_score: 26,
  home_team: 'HOU',
  home_score: 23,
  location: 'Home',
  temp: null,
  stadium_id: 'HOU00',
  stadium: 'NRG Stadium',
};

const unplayed: NflverseGameRow = {
  ...played,
  game_id: '2026_18_PHI_NYG',
  season: 2026,
  week: 18,
  gameday: '2027-01-10',
  gametime: '13:00',
  away_team: 'PHI',
  away_score: null,
  home_team: 'NYG',
  home_score: null,
  stadium_id: 'NYC01',
};

describe('scheduleGame', () => {
  it('approximates finalAt as scheduledStart + 4h only when a score is present', () => {
    const game = scheduleGame(played);
    expect(game.status).toBe('final');
    expect(game.scheduledStart).toBe('2024-11-11T01:20:00.000Z');
    expect(game.finalAt).toBe('2024-11-11T05:20:00.000Z');
    expect(approxFinalAt(game.scheduledStart)).toBe(game.finalAt);
    expect(scheduleGame(unplayed)).toMatchObject({
      status: 'scheduled',
      finalAt: null,
      homeScore: null,
    });
  });

  it('keeps the detail-pass finalAt when one already exists', () => {
    expect(scheduleGame(played, '2024-11-11T04:41:02.000Z').finalAt).toBe(
      '2024-11-11T04:41:02.000Z',
    );
    expect(scheduleGame(unplayed, '2027-01-10T21:00:00.000Z').finalAt).toBeNull();
  });

  it('groups rows by season', () => {
    const grouped = groupBySeason([played, unplayed, { ...played, game_id: '2024_11_X_Y' }]);
    expect([...grouped.keys()]).toEqual([2024, 2026]);
    expect(grouped.get(2024)).toHaveLength(2);
  });
});
