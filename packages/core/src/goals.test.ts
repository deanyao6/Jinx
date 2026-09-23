import { describe, expect, it } from 'vitest';

import {
  GOAL_TEMPLATES,
  evaluateGoal,
  suggestAttendanceGoal,
  validateGoalDefinition,
  type GoalDefinition,
  type GoalGame,
} from './goals.js';

let n = 0;
function g(p: Partial<GoalGame> = {}): GoalGame {
  n++;
  return {
    gameId: `g${n}`,
    sport: 'mlb',
    scheduledStart: `2027-06-${String((n % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    year: 2027,
    venueId: 'cbp',
    homeTeamId: 'phi',
    awayTeamId: 'nym',
    homeFranchiseId: 'mlb-143',
    awayFranchiseId: 'mlb-121',
    rootingTeamId: 'phi',
    rootingFranchiseId: 'mlb-143',
    rootingBasis: 'favorite',
    result: 'win',
    events: [],
    companions: [],
    isNewVenue: false,
    isNewState: false,
    timezone: null,
    temperatureF: null,
    isDoubleheader: false,
    isOpeningDay: false,
    distanceFromHomeMiles: null,
    isFinal: true,
    ...p,
  };
}

describe('evaluateGoal: spec examples', () => {
  it('attend 20 MLB games in 2027', () => {
    const def: GoalDefinition = { type: 'count', target: 20, filter: { sport: 'mlb', year: 2027 } };
    const games = [
      ...Array.from({ length: 19 }, () => g()),
      g({ sport: 'nfl' }),
      g({ year: 2026 }),
    ];
    expect(evaluateGoal(def, games)).toEqual({ current: 19, target: 20, completed: false });
    expect(evaluateGoal(def, [...games, g()]).completed).toBe(true);
  });
  it('HRs in 5 ballparks in 2027', () => {
    const def: GoalDefinition = {
      type: 'distinct_venues',
      target: 5,
      filter: { event: 'home_run', year: 2027 },
    };
    const games = ['a', 'b', 'c', 'a', 'd'].map((v) => g({ venueId: v, events: ['home_run'] }));
    expect(evaluateGoal(def, [...games, g({ venueId: 'e', events: [] })])).toEqual({
      current: 4,
      target: 5,
      completed: false,
    });
    expect(evaluateGoal(def, [...games, g({ venueId: 'e', events: ['home_run'] })]).completed).toBe(
      true,
    );
  });
  it('all_of: HRs in 5 ballparks and a walk-off', () => {
    const def: GoalDefinition = {
      type: 'all_of',
      items: [
        { type: 'distinct_venues', target: 5, filter: { event: 'home_run' } },
        { type: 'count', target: 1, filter: { event: 'walk_off' } },
      ],
    };
    const hr = ['a', 'b', 'c', 'd', 'e'].map((v) => g({ venueId: v, events: ['home_run'] }));
    const partial = evaluateGoal(def, hr);
    expect(partial.completed).toBe(false);
    expect(partial.current).toBe(1);
    expect(partial.items?.[0]?.completed).toBe(true);
    const done = evaluateGoal(def, [...hr, g({ events: ['walk_off', 'home_run'] })]);
    expect(done.completed).toBe(true);
  });
  it('exists: see your team on the road', () => {
    const def: GoalDefinition = {
      type: 'exists',
      filter: { team: 'mlb-143', venue_not_home: true },
    };
    expect(evaluateGoal(def, [g()]).completed).toBe(false); // home game
    const road = g({
      homeTeamId: 'nym',
      awayTeamId: 'phi',
      homeFranchiseId: 'mlb-121',
      awayFranchiseId: 'mlb-143',
      venueId: 'citi',
    });
    expect(evaluateGoal(def, [road]).completed).toBe(true);
    const neutralRooting = g({
      rootingTeamId: null,
      rootingFranchiseId: null,
      rootingBasis: null,
      result: null,
    });
    expect(evaluateGoal(def, [neutralRooting]).completed).toBe(false);
  });
  it('record: pledge record at least .500 over 10 games', () => {
    const def: GoalDefinition = {
      type: 'record',
      filter: { rooting_basis: 'pledge' },
      min_win_pct: 0.5,
      min_games: 10,
    };
    const pledged = (result: 'win' | 'loss') =>
      g({ rootingBasis: 'pledge', result, pledge: { status: 'valid', winProbAtPledge: 0.5 } });
    const nine = [
      ...Array.from({ length: 5 }, () => pledged('win')),
      ...Array.from({ length: 4 }, () => pledged('loss')),
    ];
    expect(evaluateGoal(def, nine)).toEqual({ current: 9, target: 10, completed: false });
    expect(evaluateGoal(def, [...nine, pledged('win')]).completed).toBe(true);
    expect(evaluateGoal(def, [...nine, pledged('loss'), pledged('loss')]).completed).toBe(false);
  });
});

describe('evaluateGoal: templates and edge cases', () => {
  it('ignores games that are not final', () => {
    expect(evaluateGoal({ type: 'count', target: 1 }, [g({ isFinal: false })]).completed).toBe(
      false,
    );
  });
  it('vs expected sums valid pledges only', () => {
    const def: GoalDefinition = { type: 'vs_expected', min: 0.5 };
    const games = [
      g({
        rootingBasis: 'pledge',
        result: 'win',
        pledge: { status: 'valid', winProbAtPledge: 0.3 },
      }),
      g({
        rootingBasis: 'pledge',
        result: 'loss',
        pledge: { status: 'valid', winProbAtPledge: 0.1 },
      }),
      g({
        rootingBasis: 'pledge',
        result: 'win',
        pledge: { status: 'void', winProbAtPledge: 0.1 },
      }),
    ];
    expect(evaluateGoal(def, games)).toEqual({ current: 0.6, target: 0.5, completed: true });
  });
  it('distinct people and new venues', () => {
    expect(
      evaluateGoal({ type: 'distinct_people', target: 3 }, [
        g({ companions: ['dad', 'maya'] }),
        g({ companions: ['dad', 'jordan'] }),
      ]).completed,
    ).toBe(true);
    expect(
      evaluateGoal({ type: 'distinct_venues', target: 2, filter: { new_venue: true } }, [
        g({ venueId: 'a', isNewVenue: true }),
        g({ venueId: 'b', isNewVenue: false }),
      ]).current,
    ).toBe(1);
  });
  it('every template builds a valid definition', () => {
    for (const t of GOAL_TEMPLATES) {
      const def = t.build(t.defaultN, 2027, { favoriteFranchiseId: 'mlb-143' });
      expect(validateGoalDefinition(def)).toBe(true);
      expect(typeof t.title(t.defaultN)).toBe('string');
    }
  });
  it('rejects malformed definitions', () => {
    expect(validateGoalDefinition({ type: 'count' })).toBe(false);
    expect(validateGoalDefinition({ type: 'all_of', items: [] })).toBe(false);
    expect(validateGoalDefinition({ type: 'drop_table' })).toBe(false);
    expect(validateGoalDefinition('nope')).toBe(false);
  });
  it('suggests about 25% more games than last year', () => {
    expect(suggestAttendanceGoal(14)).toBe(18);
    expect(suggestAttendanceGoal(1)).toBe(2);
    expect(suggestAttendanceGoal(0)).toBeNull();
  });
});
