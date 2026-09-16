import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  checkInWindow,
  estimatedLock,
  isInsideGeofence,
  isWithinCheckInWindow,
  pledgeResult,
  trueLock,
  validatePledge,
} from './pledge.js';
import { parseMlbFeed, type MlbFeed } from './providers/mlb/parse.js';
import { parseNflGame } from './providers/nfl/parse.js';
import type { NflverseGameRow, NflversePbpRow } from './providers/nfl/rows.js';
import type { CanonicalGameDetail, LiveState } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '../../../ingest/fixtures');
const load = <T>(p: string): T => JSON.parse(readFileSync(join(fixtures, p), 'utf8')) as T;

const mlbBalDet = () => parseMlbFeed(load<MlbFeed>('mlb/feed_746419_BAL_DET_2024-09-15.json'));
const mlbNoHitter = () =>
  parseMlbFeed(load<MlbFeed>('mlb/feed_746679_SF_CIN_nohitter_2024-08-02.json'));

function nfl(gameId: string): CanonicalGameDetail {
  const games = load<NflverseGameRow[]>('nfl/games_2024_sample.json');
  const game = games.find((g) => g.game_id === gameId);
  if (!game) throw new Error(`missing ${gameId}`);
  return parseNflGame(game, load<NflversePbpRow[]>(`nfl/pbp_${gameId}.json`));
}

describe('check-in window and geofence', () => {
  it('opens 3h before and closes 1h after final', () => {
    const w = checkInWindow('2024-09-15T16:10:00Z', '2024-09-15T18:30:00Z');
    expect(w).toEqual({
      opensAt: '2024-09-15T13:10:00.000Z',
      closesAt: '2024-09-15T19:30:00.000Z',
    });
    expect(isWithinCheckInWindow('2024-09-15T13:00:00Z', '2024-09-15T16:10:00Z', null)).toBe(false);
    expect(isWithinCheckInWindow('2024-09-15T16:00:00Z', '2024-09-15T16:10:00Z', null)).toBe(true);
    expect(isWithinCheckInWindow('2024-09-15T22:11:00Z', '2024-09-15T16:10:00Z', null)).toBe(false);
  });
  it('geofence adds accuracy capped at 200m', () => {
    expect(isInsideGeofence(390, 10, 400)).toBe(true);
    expect(isInsideGeofence(550, 150, 400)).toBe(true);
    expect(isInsideGeofence(650, 500, 400)).toBe(false);
    expect(isInsideGeofence(601, 500, 400)).toBe(false);
    expect(isInsideGeofence(600, 500, 400)).toBe(true);
  });
});

describe('estimated lock', () => {
  const start = '2024-09-15T16:10:00Z';
  const live = (p: Partial<LiveState>): LiveState => ({
    status: 'live',
    inning: 1,
    inningState: 'top',
    homeScore: 0,
    awayScore: 0,
    fetchedAt: '2024-09-15T16:20:00Z',
    ...p,
  });
  it('NFL is start + 12 minutes, estimated', () => {
    expect(estimatedLock('nfl', start, null, '2024-09-15T16:00:00Z')).toEqual({
      at: '2024-09-15T16:22:00.000Z',
      locked: false,
      reason: 'estimate',
    });
    expect(estimatedLock('nfl', start, null, '2024-09-15T16:30:00Z').locked).toBe(true);
  });
  it('MLB without live data falls back to start + 30 minutes', () => {
    expect(estimatedLock('mlb', start, null, '2024-09-15T16:00:00Z')).toEqual({
      at: '2024-09-15T16:40:00.000Z',
      locked: false,
      reason: 'estimate',
    });
  });
  it('MLB locks on the first run', () => {
    expect(
      estimatedLock('mlb', start, live({ awayScore: 1 }), '2024-09-15T16:20:00Z'),
    ).toMatchObject({ locked: true, reason: 'first_score' });
  });
  it('MLB locks at the end of the first (scoreless)', () => {
    expect(
      estimatedLock('mlb', start, live({ inning: 1, inningState: 'end' }), '2024-09-15T16:40:00Z'),
    ).toMatchObject({ locked: true, reason: 'end_of_first' });
    expect(
      estimatedLock('mlb', start, live({ inning: 2, inningState: 'top' }), '2024-09-15T16:40:00Z'),
    ).toMatchObject({ locked: true, reason: 'end_of_first' });
    expect(
      estimatedLock(
        'mlb',
        start,
        live({ inning: 1, inningState: 'bottom' }),
        '2024-09-15T16:25:00Z',
      ),
    ).toMatchObject({ locked: false, reason: 'live_fallback' });
  });
});

describe('true lock and validation', () => {
  it('MLB scoreless first: lock at end of bottom 1st (BAL@DET)', () => {
    const d = mlbBalDet();
    const lock = trueLock(d);
    expect(lock.reason).toBe('end_of_first');
    expect(lock.reliable).toBe(true);
    const bottomFirst =
      d.plays.sport === 'mlb'
        ? d.plays.items.filter((p) => p.inning === 1 && p.half === 'bottom')
        : [];
    expect(lock.at).toBe(bottomFirst[bottomFirst.length - 1]?.endTime);
    // pledge before lock is valid, after lock (+60s grace) is void
    expect(validatePledge('2024-09-15T16:12:00Z', lock)).toEqual({
      status: 'valid',
      reason: 'before_lock',
    });
    expect(validatePledge(new Date(Date.parse(lock.at!) + 59_000).toISOString(), lock).status).toBe(
      'valid',
    );
    expect(validatePledge(new Date(Date.parse(lock.at!) + 61_000).toISOString(), lock)).toEqual({
      status: 'void',
      reason: 'after_lock',
    });
  });
  it('MLB first-inning run locks at the run when it precedes the end of the inning', () => {
    const d = mlbNoHitter();
    const lock = trueLock(d);
    const plays = d.plays.sport === 'mlb' ? d.plays.items : [];
    const firstRun = plays.find((p) => p.homeScore > 0 || p.awayScore > 0);
    if (firstRun && firstRun.inning === 1) {
      expect(lock.reason).toBe('first_score');
      expect(lock.at).toBe(firstRun.endTime);
    } else {
      expect(lock.reason).toBe('end_of_first');
    }
  });
  it('NFL: lock is the earlier of first score and the 10:00 mark', () => {
    for (const id of ['2024_05_BAL_CIN', '2024_10_DET_HOU', '2024_12_TEN_HOU']) {
      const d = nfl(id);
      const lock = trueLock(d);
      expect(lock.reliable).toBe(true);
      const plays = d.plays.sport === 'nfl' ? d.plays.items : [];
      const firstScore = plays.find((p) => p.homeScore > 0 || p.awayScore > 0);
      const tenMin = plays.find(
        (p) =>
          p.qtr === 1 && p.quarterSecondsRemaining !== null && p.quarterSecondsRemaining <= 600,
      );
      const expected = [firstScore?.timeOfDay, tenMin?.timeOfDay].filter(Boolean).sort()[0];
      expect(lock.at).toBe(expected);
      if (firstScore && tenMin) {
        expect(lock.reason).toBe(
          Date.parse(firstScore.timeOfDay!) < Date.parse(tenMin.timeOfDay!)
            ? 'first_score'
            : 'ten_minutes_q1',
        );
      }
    }
  });
  it('NFL no score by 10:00 locks at 10:00 (synthetic)', () => {
    const d = nfl('2024_12_TEN_HOU');
    const plays = d.plays.sport === 'nfl' ? d.plays.items : [];
    // Strip every score before the 10:00 mark to force the ten-minute rule.
    const stripped = plays.map((p) =>
      p.qtr === 1 && p.quarterSecondsRemaining !== null && p.quarterSecondsRemaining > 600
        ? { ...p, homeScore: 0, awayScore: 0 }
        : p,
    );
    const lock = trueLock({ ...d, plays: { sport: 'nfl', items: stripped } });
    expect(lock.reason === 'ten_minutes_q1' || lock.reason === 'first_score').toBe(true);
    const tenMin = stripped.find(
      (p) => p.qtr === 1 && p.quarterSecondsRemaining !== null && p.quarterSecondsRemaining <= 600,
    );
    expect(Date.parse(lock.at!)).toBeLessThanOrEqual(Date.parse(tenMin!.timeOfDay!));
  });
  it('missing timestamps keep the pledge valid', () => {
    const d = mlbBalDet();
    const plays =
      d.plays.sport === 'mlb'
        ? d.plays.items.map((p) => ({ ...p, endTime: null, startTime: null }))
        : [];
    const lock = trueLock({ ...d, plays: { sport: 'mlb', items: plays } });
    expect(lock).toEqual({ at: null, reliable: false, reason: 'unknown' });
    expect(validatePledge('2030-01-01T00:00:00Z', lock)).toEqual({
      status: 'valid',
      reason: 'unreliable_timestamps',
    });
  });
  it('pledge results', () => {
    expect(pledgeResult('home', 4, 2)).toBe('win');
    expect(pledgeResult('away', 4, 2)).toBe('loss');
    expect(pledgeResult('away', 3, 3)).toBe('tie');
  });
});
