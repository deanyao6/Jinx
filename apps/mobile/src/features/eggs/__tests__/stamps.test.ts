import { eggs } from '@/features/eggs/flags';
import {
  goldenVenueIds,
  isRareMoment,
  RARE_MOMENTS,
  RARE_MOMENT_TYPES,
  stampWear,
  type WitnessedGame,
} from '@/features/eggs/stamps';

const OFF = { wornStamps: false, goldenStamps: false } as const;

describe('egg flags', () => {
  it('ships both stamp eggs switched on, as a plain object', () => {
    expect(eggs.wornStamps).toBe(true);
    expect(eggs.goldenStamps).toBe(true);
    expect(Object.values(eggs).every((v) => typeof v === 'boolean')).toBe(true);
  });
});

describe('stampWear', () => {
  it.each([
    [0, 0],
    [1, 0],
    [4, 0],
    [5, 1],
    [9, 1],
    [10, 2],
    [11, 2],
    [162, 2],
  ])('%i visits is wear %i', (visits, wear) => {
    expect(stampWear(visits)).toBe(wear);
  });

  it('is crisp when the visits are unknown', () => {
    expect(stampWear(null)).toBe(0);
    expect(stampWear(undefined)).toBe(0);
    expect(stampWear(Number.NaN)).toBe(0);
  });

  it('is always crisp with the egg switched off', () => {
    expect(stampWear(40, OFF)).toBe(0);
  });
});

describe('rare moments', () => {
  it('has a row per sport in v1', () => {
    expect(Object.keys(RARE_MOMENTS).sort()).toEqual(['mlb', 'nba', 'nfl']);
  });

  it.each([
    'no_hitter',
    'perfect_game',
    'cycle',
    'walk_off',
    'walk_off_home_run',
    'immaculate_inning',
  ])('counts an MLB %s whoever won', (type) => {
    expect(isRareMoment('mlb', type, 'loss')).toBe(true);
    expect(isRareMoment('mlb', type, null)).toBe(true);
  });

  it.each(['home_run', 'grand_slam', 'extra_innings', 'shutout'])(
    'does not count an MLB %s, which is not rare enough',
    (type) => {
      expect(isRareMoment('mlb', type, 'win')).toBe(false);
    },
  );

  it('counts NFL overtime only as a win', () => {
    expect(isRareMoment('nfl', 'overtime', 'win')).toBe(true);
    expect(isRareMoment('nfl', 'overtime', 'loss')).toBe(false);
    expect(isRareMoment('nfl', 'overtime', 'tie')).toBe(false);
    // Watched as a neutral: there was no side to win with.
    expect(isRareMoment('nfl', 'overtime', null)).toBe(false);
  });

  it('counts a score as time expires and a comeback from 14 down whoever won', () => {
    expect(isRareMoment('nfl', 'walk_off_score', 'loss')).toBe(true);
    expect(isRareMoment('nfl', 'comeback_14', null)).toBe(true);
    expect(isRareMoment('nfl', 'pick_six', 'win')).toBe(false);
    expect(isRareMoment('nfl', 'late_go_ahead_score', 'win')).toBe(false);
  });

  it('keeps each sport to its own row', () => {
    expect(isRareMoment('nfl', 'no_hitter', 'win')).toBe(false);
    expect(isRareMoment('mlb', 'comeback_14', 'win')).toBe(false);
    expect(isRareMoment('nba', 'no_hitter', 'win')).toBe(false);
    // Basketball counts an overtime win too, and a buzzer-beater whichever way it went.
    expect(isRareMoment('nba', 'overtime', 'win')).toBe(true);
    expect(isRareMoment('nba', 'overtime', 'loss')).toBe(false);
    expect(isRareMoment('nba', 'buzzer_beater', 'loss')).toBe(true);
  });

  it('lists every type once, for the query', () => {
    expect(RARE_MOMENT_TYPES).toEqual([
      'buzzer_beater',
      'comeback_14',
      'cycle',
      'fifty_points',
      'immaculate_inning',
      'no_hitter',
      'overtime',
      'perfect_game',
      'quadruple_double',
      'walk_off',
      'walk_off_home_run',
      'walk_off_score',
    ]);
  });
});

describe('goldenVenueIds', () => {
  const games: WitnessedGame[] = [
    { sport: 'mlb', venueId: 'cbp', eventTypes: ['home_run', 'walk_off_home_run'], result: 'win' },
    { sport: 'mlb', venueId: 'citi', eventTypes: ['home_run'], result: 'loss' },
    { sport: 'nfl', venueId: 'linc', eventTypes: ['overtime'], result: 'loss' },
    { sport: 'nfl', venueId: 'metlife', eventTypes: ['overtime'], result: 'win' },
    { sport: 'nfl', venueId: null, eventTypes: ['comeback_14'], result: 'win' },
  ];

  it('is the stadiums where something rare was seen', () => {
    expect([...goldenVenueIds(games)].sort()).toEqual(['cbp', 'metlife']);
  });

  it('turns one later game at the same stadium into gold for the stadium', () => {
    const more = [
      ...games,
      { sport: 'nfl', venueId: 'linc', eventTypes: ['walk_off_score'], result: 'loss' as const },
    ];
    expect(goldenVenueIds(more).has('linc')).toBe(true);
  });

  it('is empty with the egg switched off', () => {
    expect(goldenVenueIds(games, OFF).size).toBe(0);
  });
});
