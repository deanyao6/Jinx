import { describe, expect, it } from 'vitest';

import { mlbPollStep, type MlbPollInput } from './mlbPoll.js';
import type { MlbLivePlay } from './events.js';

const play = (ab: number, inning: number, half: 'top' | 'bottom', r: Partial<MlbLivePlay['result']>, wp: number): MlbLivePlay => ({
  about: { inning, halfInning: half, atBatIndex: ab, isComplete: true },
  result: { eventType: 'field_out', description: 'Out.', rbi: 0, homeScore: 0, awayScore: 0, ...r },
  homeTeamWinProbability: wp,
});

describe('one poll of the MLB feed', () => {
  const entries = [
    play(0, 1, 'top', {}, 50),
    play(1, 1, 'bottom', { eventType: 'home_run', rbi: 1, homeScore: 1, description: 'Solo homer.' }, 58),
    play(2, 7, 'top', { eventType: 'single', awayScore: 1, homeScore: 1, rbi: 1 }, 45),
    play(3, 8, 'bottom', { eventType: 'home_run', rbi: 3, homeScore: 4, awayScore: 1, description: 'Harper homers (23). Two score.' }, 92),
  ];
  const input = (over: Partial<MlbPollInput>): MlbPollInput => ({
    status: 'live',
    linescore: { currentInning: 8, inningState: 'Bottom', teams: { home: { runs: 4, hits: 6 }, away: { runs: 1, hits: 3 } } },
    entries,
    fetchedAt: 'now',
    ...over,
  });

  it('judges only the plays since the last poll, and fires the scheduled prompt in the 8th', () => {
    const first = mlbPollStep({ lastAtBat: -1, scheduledReported: false }, input({}));
    expect(first.events.map((e) => e.rule)).toEqual(['multi_run_home_run']);
    expect(first.events[0]).toMatchObject({ key: 'mlb:ab:3', audience: 'home', significance: 47, periodLabel: 'Bottom 8th' });
    expect(first.scheduled).toEqual({ periodLabel: 'Bottom 8th', homeScore: 4, awayScore: 1, reason: 'blowout' });
    expect(first.next).toEqual({ lastAtBat: 3, scheduledReported: true });
    const again = mlbPollStep(first.next, input({}));
    expect(again.events).toEqual([]);
    expect(again.scheduled).toBeNull();
  });

  it('a walk-off on the final poll goes to everyone', () => {
    const wo = [...entries, play(4, 9, 'bottom', { eventType: 'single', rbi: 1, homeScore: 5, awayScore: 4 }, 100)];
    const out = mlbPollStep(
      { lastAtBat: 3, scheduledReported: true },
      input({ status: 'final', entries: wo, linescore: { currentInning: 9, inningState: 'Bottom', teams: { home: { runs: 5, hits: 8 }, away: { runs: 4, hits: 9 } } } }),
    );
    // Home was 4-1 up after ab 3; for a walk-off the fixture needs them behind or level before the play.
    expect(out.events.map((e) => e.rule)).toEqual([]);
    const level = [...entries.slice(0, 3), play(3, 8, 'bottom', { eventType: 'double', rbi: 0, homeScore: 1, awayScore: 1 }, 50), play(4, 9, 'bottom', { eventType: 'single', rbi: 1, homeScore: 2, awayScore: 1 }, 100)];
    const out2 = mlbPollStep({ lastAtBat: 3, scheduledReported: true }, input({ status: 'final', entries: level, linescore: { currentInning: 9, inningState: 'Bottom', teams: { home: { runs: 2, hits: 8 }, away: { runs: 1, hits: 9 } } } }));
    expect(out2.events.map((e) => [e.rule, e.audience])).toEqual([['walk_off', 'all']]);
  });
});
