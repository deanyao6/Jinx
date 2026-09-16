import { describe, expect, it } from 'vitest';
import type { GameEvent, MomentType } from '../../types.js';
import { FIXTURE_GAME_IDS, loadDetail } from './fixtures.test-helpers.js';
import { detectNflMoments } from './moments.js';

const ALL_TYPES: MomentType[] = [
  'overtime',
  'late_go_ahead_score',
  'walk_off_score',
  'pick_six',
  'fumble_return_td',
  'kick_return_td',
  'safety',
  'long_field_goal',
  'comeback_14',
];

function ofType(events: GameEvent[], type: MomentType): GameEvent[] {
  return events.filter((e) => e.type === type);
}

function counts(events: GameEvent[]): Record<MomentType, number> {
  const out = {} as Record<MomentType, number>;
  for (const type of ALL_TYPES) out[type] = ofType(events, type).length;
  return out;
}

describe('detectNflMoments', () => {
  it('sets side, occurredAt and a description on every event', () => {
    for (const gameId of FIXTURE_GAME_IDS) {
      const events = detectNflMoments(loadDetail(gameId));
      for (const event of events) {
        expect(ALL_TYPES).toContain(event.type);
        if (event.type === 'overtime') expect(event.side).toBeNull();
        else expect(['home', 'away']).toContain(event.side);
        expect(typeof event.occurredAt).toBe('string');
        expect(typeof event.detail['description']).toBe('string');
        expect(event.providerPlayerId).toBeNull();
        expect(event.playerName).toBeNull();
      }
    }
  });

  it('2024_12_TEN_HOU: pick-six, safety and four 50+ field goals, nothing game-level', () => {
    const events = detectNflMoments(loadDetail('2024_12_TEN_HOU'));
    expect(counts(events)).toEqual({
      overtime: 0,
      late_go_ahead_score: 0,
      walk_off_score: 0,
      pick_six: 1,
      fumble_return_td: 0,
      kick_return_td: 0,
      safety: 1,
      long_field_goal: 4,
      comeback_14: 0,
    });

    const pickSix = ofType(events, 'pick_six')[0];
    expect(pickSix?.side).toBe('home');
    expect(pickSix?.occurredAt).toBe('2024-11-24T20:14:57Z');
    expect(pickSix?.detail).toMatchObject({ period: 3, clock: '00:15', yards: 65 });
    expect(pickSix?.detail['description']).toContain('INTERCEPTED by 20-J.Ward');

    const safety = ofType(events, 'safety')[0];
    expect(safety?.side).toBe('away'); // TEN scored on HOU's sack in the end zone
    expect(safety?.occurredAt).toBe('2024-11-24T21:08:08.703Z');
    expect(safety?.detail).toMatchObject({
      period: 4,
      clock: '01:17',
      homeScore: 27,
      awayScore: 32,
    });

    const fgs = ofType(events, 'long_field_goal').map((e) => [e.side, e.detail['yards']]);
    expect(fgs).toEqual([
      ['away', 51],
      ['away', 56],
      ['away', 51],
      ['home', 54],
    ]);
  });

  it('2024_04_NO_ATL: muffed punt is a fumble return TD (not a kick return); late go-ahead FG followed by a kickoff is not a walk-off', () => {
    const events = detectNflMoments(loadDetail('2024_04_NO_ATL'));
    expect(counts(events)).toEqual({
      overtime: 0,
      late_go_ahead_score: 3,
      walk_off_score: 0,
      pick_six: 1,
      fumble_return_td: 1,
      kick_return_td: 0,
      safety: 0,
      long_field_goal: 2,
      comeback_14: 0,
    });

    const fumble = ofType(events, 'fumble_return_td')[0];
    expect(fumble?.side).toBe('home');
    expect(fumble?.detail).toMatchObject({ period: 1, clock: '11:25', onKick: true });
    expect(fumble?.detail['description']).toContain('MUFFS');

    expect(ofType(events, 'pick_six')[0]).toMatchObject({
      side: 'home',
      occurredAt: '2024-09-29T17:55:52.337Z',
    });
    expect(ofType(events, 'pick_six')[0]?.detail).toMatchObject({ yards: 47 });

    const late = ofType(events, 'late_go_ahead_score');
    expect(late.map((e) => [e.side, e.detail['clock'], e.detail['tying']])).toEqual([
      ['away', '01:04', true], // Kamara TD ties it 23-23
      ['away', '01:00', false], // extra point puts NO ahead 24-23
      ['home', '00:07', false], // Koo 58-yarder puts ATL ahead 26-24
    ]);
    expect(late[2]?.occurredAt).toBe('2024-09-29T20:01:59.763Z');

    expect(ofType(events, 'long_field_goal').map((e) => e.detail['yards'])).toEqual([53, 58]);
  });

  it('2024_05_BAL_CIN: overtime, safety, tying 56-yarder at 1:40, OT walk-off field goal', () => {
    const events = detectNflMoments(loadDetail('2024_05_BAL_CIN'));
    expect(counts(events)).toEqual({
      overtime: 1,
      late_go_ahead_score: 1,
      walk_off_score: 1,
      pick_six: 0,
      fumble_return_td: 0,
      kick_return_td: 0,
      safety: 1,
      long_field_goal: 1,
      comeback_14: 0,
    });

    const overtime = ofType(events, 'overtime')[0];
    expect(overtime?.side).toBeNull();
    expect(overtime?.detail).toMatchObject({ periods: 5, homeScore: 38, awayScore: 41 });
    expect(overtime?.occurredAt).toMatch(/^2024-10-06T20:/);

    expect(ofType(events, 'safety')[0]).toMatchObject({ side: 'home' });
    expect(ofType(events, 'safety')[0]?.detail).toMatchObject({ period: 2, clock: '05:52' });

    const late = ofType(events, 'late_go_ahead_score')[0];
    expect(late?.side).toBe('away');
    expect(late?.detail).toMatchObject({
      clock: '01:40',
      tying: true,
      homeScore: 38,
      awayScore: 38,
    });

    const walkOff = ofType(events, 'walk_off_score')[0];
    expect(walkOff?.side).toBe('away');
    expect(walkOff?.occurredAt).toBe('2024-10-06T20:30:32Z');
    expect(walkOff?.detail).toMatchObject({ period: 5, clock: '03:36', overtime: true, yards: 24 });
    expect(walkOff?.detail['description']).toContain('24 yard field goal is GOOD');
  });

  it('2024_10_DET_HOU: 14+ comeback and a walk-off field goal as time expires', () => {
    const events = detectNflMoments(loadDetail('2024_10_DET_HOU'));
    expect(counts(events)).toEqual({
      overtime: 0,
      late_go_ahead_score: 1,
      walk_off_score: 1,
      pick_six: 0,
      fumble_return_td: 0,
      kick_return_td: 0,
      safety: 0,
      long_field_goal: 3,
      comeback_14: 1,
    });

    const comeback = ofType(events, 'comeback_14')[0];
    expect(comeback?.side).toBe('away');
    expect(comeback?.detail).toMatchObject({
      maxDeficit: 16,
      period: 2,
      clock: '00:12',
      homeScore: 23,
      awayScore: 7,
      finalHomeScore: 23,
      finalAwayScore: 26,
    });
    expect(comeback?.occurredAt).toBe('2024-11-11T02:48:12Z');

    const walkOff = ofType(events, 'walk_off_score')[0];
    expect(walkOff?.side).toBe('away');
    expect(walkOff?.occurredAt).toBe('2024-11-11T04:35:04Z');
    expect(walkOff?.detail).toMatchObject({
      period: 4,
      clock: '00:04',
      overtime: false,
      yards: 52,
    });

    const late = ofType(events, 'late_go_ahead_score')[0];
    expect(late?.side).toBe('away');
    expect(late?.detail).toMatchObject({
      clock: '00:04',
      tying: false,
      leadBefore: 0,
      leadAfter: 3,
    });

    expect(ofType(events, 'long_field_goal').map((e) => [e.side, e.detail['yards']])).toEqual([
      ['home', 56],
      ['away', 58],
      ['away', 52],
    ]);
  });

  it('2024_06_TB_NO: punt return TD and defensive fumble return TD; a late TD while already ahead is not a go-ahead score', () => {
    const events = detectNflMoments(loadDetail('2024_06_TB_NO'));
    expect(counts(events)).toEqual({
      overtime: 0,
      late_go_ahead_score: 0,
      walk_off_score: 0,
      pick_six: 0,
      fumble_return_td: 1,
      kick_return_td: 1,
      safety: 0,
      long_field_goal: 0,
      comeback_14: 0,
    });

    const punt = ofType(events, 'kick_return_td')[0];
    expect(punt?.side).toBe('home'); // Shaheed for NO
    expect(punt?.occurredAt).toBe('2024-10-13T17:55:42.033Z');
    expect(punt?.detail).toMatchObject({ kind: 'punt', yards: 54, period: 2, clock: '13:18' });

    const fumble = ofType(events, 'fumble_return_td')[0];
    expect(fumble?.side).toBe('away'); // TB scoop and score
    expect(fumble?.occurredAt).toBe('2024-10-13T17:14:32.760Z');
    expect(fumble?.detail).toMatchObject({ period: 1, clock: '08:54', onKick: false });
  });

  it('does not report a comeback for the losing side or a walk-off when the game continues', () => {
    // NO trailed by 24 and lost: no comeback. TB's last score came with 1:55 left and plays followed.
    const tbNo = detectNflMoments(loadDetail('2024_06_TB_NO'));
    expect(ofType(tbNo, 'comeback_14')).toHaveLength(0);
    expect(ofType(tbNo, 'walk_off_score')).toHaveLength(0);
  });

  it('overtime fires from inningsOrPeriods alone and is emitted once', () => {
    const detail = loadDetail('2024_12_TEN_HOU');
    const events = detectNflMoments({ ...detail, inningsOrPeriods: 5 });
    expect(ofType(events, 'overtime')).toHaveLength(1);
    expect(ofType(events, 'overtime')[0]?.occurredAt).toBeNull();
  });

  it('returns nothing for a game with no plays', () => {
    const detail = loadDetail('2024_12_TEN_HOU');
    expect(
      detectNflMoments({ ...detail, plays: { sport: 'nfl', items: [] }, inningsOrPeriods: null }),
    ).toEqual([]);
  });
});
