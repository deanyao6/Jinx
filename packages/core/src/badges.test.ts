import { describe, expect, it } from 'vitest';

import { BADGE_CATALOG } from './badges.js';
import { evaluateGoal, validateGoalDefinition, type GoalGame } from './goals.js';

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

/** One fixture per badge: games that earn it, and (for most) a baseline that does not. */
const FIXTURES: Record<string, { earns: GoalGame[]; fallsShort: GoalGame[] }> = {
  three_parks_weekend: {
    earns: [
      g({ venueId: 'a', scheduledStart: '2027-08-14T00:00:00Z' }),
      g({ venueId: 'b', scheduledStart: '2027-08-15T00:00:00Z' }),
      g({ venueId: 'c', scheduledStart: '2027-08-16T12:00:00Z' }),
    ],
    fallsShort: [g({ venueId: 'a' }), g({ venueId: 'b', scheduledStart: '2027-09-01T00:00:00Z' })],
  },
  walk_off_witnessed: { earns: [g({ events: ['walk_off'] })], fallsShort: [g()] },
  opening_day_x3: {
    earns: [g({ isOpeningDay: true }), g({ isOpeningDay: true }), g({ isOpeningDay: true })],
    fallsShort: [g({ isOpeningDay: true }), g({ isOpeningDay: true })],
  },
  three_time_zones: {
    earns: [g({ timezone: 'America/New_York' }), g({ timezone: 'America/Chicago' }), g({ timezone: 'America/Los_Angeles' })],
    fallsShort: [g({ timezone: 'America/New_York' }), g({ timezone: 'America/New_York' })],
  },
  arctic_game: { earns: [g({ temperatureF: 12 })], fallsShort: [g({ temperatureF: 40 })] },
  undefeated_companion: {
    earns: Array.from({ length: 5 }, () => g({ companions: ['dad'], result: 'win' })),
    fallsShort: [
      ...Array.from({ length: 4 }, () => g({ companions: ['dad'], result: 'win' })),
      g({ companions: ['dad'], result: 'loss' }),
    ],
  },
  no_hitter_witnessed: { earns: [g({ events: ['no_hitter'] })], fallsShort: [g()] },
  extra_innings_road: {
    earns: [g({ events: ['extra_innings'], homeTeamId: 'nym', awayTeamId: 'phi', rootingTeamId: 'phi' })],
    fallsShort: [g({ events: ['extra_innings'] })],
  },
  doubleheader: { earns: [g({ isDoubleheader: true })], fallsShort: [g()] },
  new_stadium_new_state: {
    earns: [g({ isNewVenue: true, isNewState: true })],
    fallsShort: [g({ isNewVenue: true, isNewState: false })],
  },
  thousand_mile_road_game: {
    earns: [
      g({
        homeTeamId: 'nym',
        awayTeamId: 'phi',
        rootingTeamId: 'phi',
        distanceFromHomeMiles: 1200,
      }),
    ],
    fallsShort: [g({ homeTeamId: 'nym', awayTeamId: 'phi', rootingTeamId: 'phi', distanceFromHomeMiles: 90 })],
  },
  grand_slam_witnessed: { earns: [g({ events: ['grand_slam'] })], fallsShort: [g()] },
  cycle_witnessed: { earns: [g({ events: ['cycle'] })], fallsShort: [g()] },
  perfect_game_witnessed: { earns: [g({ events: ['perfect_game'] })], fallsShort: [g()] },
  immaculate_inning_witnessed: { earns: [g({ events: ['immaculate_inning'] })], fallsShort: [g()] },
  shutout_witnessed: { earns: [g({ events: ['shutout'] })], fallsShort: [g()] },
  buzzer_beater_witnessed: {
    earns: [g({ sport: 'nba', events: ['buzzer_beater'] })],
    fallsShort: [g({ sport: 'nba' })],
  },
  nba_overtime_win: {
    earns: [g({ sport: 'nba', events: ['overtime'], result: 'win' })],
    fallsShort: [g({ sport: 'nba', events: ['overtime'], result: 'loss' })],
  },
  nfl_overtime_win: {
    earns: [g({ sport: 'nfl', events: ['overtime'], result: 'win' })],
    fallsShort: [g({ sport: 'nfl', events: ['overtime'], result: 'loss' })],
  },
  nfl_big_comeback: {
    earns: [g({ sport: 'nfl', events: ['comeback_14'], result: 'win' })],
    fallsShort: [g({ sport: 'nfl' })],
  },
  nba_big_comeback: {
    earns: [g({ sport: 'nba', events: ['comeback_20'], result: 'win' })],
    fallsShort: [g({ sport: 'nba' })],
  },
  hat_trick_witnessed: {
    earns: [g({ sport: 'mls', events: ['hat_trick'] })],
    fallsShort: [g({ sport: 'mls' })],
  },
  mls_shootout_witnessed: {
    earns: [g({ sport: 'mls', events: ['shootout'] })],
    fallsShort: [g({ sport: 'mls' })],
  },
  ten_stadiums: {
    earns: 'abcdefghij'.split('').map((v) => g({ venueId: v })),
    fallsShort: 'abcdefghi'.split('').map((v) => g({ venueId: v })),
  },
  hundred_games: {
    earns: Array.from({ length: 100 }, () => g()),
    fallsShort: Array.from({ length: 99 }, () => g()),
  },
  worn_stamps: {
    earns: Array.from({ length: 5 }, () => g({ venueId: 'cbp' })),
    fallsShort: Array.from({ length: 4 }, () => g({ venueId: 'cbp' })),
  },
  golden_stamps: { earns: [g({ events: ['cycle'] })], fallsShort: [g()] },
  record_rewind: { earns: [g()], fallsShort: [] },
  curse_breaker: {
    earns: [
      ...Array.from({ length: 5 }, () => g({ result: 'loss' })),
      g({ result: 'win', scheduledStart: '2027-12-01T00:00:00Z' }),
    ],
    fallsShort: [
      ...Array.from({ length: 4 }, () => g({ result: 'loss' })),
      g({ result: 'win', scheduledStart: '2027-12-01T00:00:00Z' }),
    ],
  },
  rally_cap: {
    earns: [g({ events: ['walk_off'], result: 'win' })],
    fallsShort: [g({ events: ['walk_off'], result: 'loss' })],
  },
  stretch_confetti: { earns: [g()], fallsShort: [] },
  certified_jinx: {
    earns: [
      ...Array.from({ length: 4 }, () => g({ companions: ['nemesis'], result: 'loss' })),
      g({ companions: ['nemesis'], result: 'win' }),
    ],
    fallsShort: [
      ...Array.from({ length: 3 }, () => g({ companions: ['nemesis'], result: 'loss' })),
      g({ companions: ['nemesis'], result: 'win' }),
    ],
  },
  secret_handshake: { earns: [g({ companions: ['maya'] })], fallsShort: [g()] },
};

describe('badges: every launch badge is validated JSON', () => {
  it.each(BADGE_CATALOG.map((b) => [b.key, b] as const))('%s has a valid GoalDefinition', (_key, badge) => {
    expect(validateGoalDefinition(badge.criteria)).toBe(true);
  });
});

describe('badges: fixtures', () => {
  it('every non-trivial badge has a fixture', () => {
    const missing = BADGE_CATALOG.map((b) => b.key).filter((k) => !(k in FIXTURES));
    expect(missing).toEqual([]);
  });

  it.each(BADGE_CATALOG.map((b) => [b.key, b] as const))('%s is earned by its fixture', (key, badge) => {
    const { earns, fallsShort } = FIXTURES[key]!;
    expect(evaluateGoal(badge.criteria, earns).completed).toBe(true);
    if (fallsShort.length > 0 || earns.length > 0) {
      expect(evaluateGoal(badge.criteria, fallsShort).completed).toBe(false);
    }
  });
});
