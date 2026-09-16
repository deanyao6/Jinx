import type {
  GameDayFixture,
  GuideFixture,
  PassportFixture,
  PickASideFixture,
  ProfileFixture,
  ReliveFixture,
} from './shapes';
import type { Repository } from './types';

/**
 * The repository with nothing in it.
 *
 * This is what a signed-in user gets for anything the Supabase implementation cannot serve
 * yet, and what every method returns while their data is still loading. It is deliberately
 * NOT the demo fixtures: showing someone else's 31–17 record and 48 games to a user who
 * logged one game is worse than showing them an empty screen, because an empty screen is
 * true and can be acted on, while a fabricated one cannot be tested against anything.
 *
 * Every value here is a real empty: zero records, no rows, no name. Each screen pairs it
 * with an empty state that says which of the two it is — nothing logged yet, or nothing
 * built yet. See SPEC.md 8.9.
 */

const NO_RECORD = '0 – 0';

export function emptyPassport(): PassportFixture {
  return {
    teamKey: 'none',
    label: 'LIFETIME RECORD',
    badge: '0 GAMES ATTENDED',
    record: NO_RECORD,
    // The same em dash `formatWinRate` writes for a record with no decided games.
    winRate: '–',
    streak: 'No active streak',
    lastGame: 'No games logged yet',
    lastGameId: '',
    stampCount: 'View All (0)',
    cards: [],
    superlatives: [],
  };
}

/** No game, so no sides and no probabilities to draw. */
export function emptyPickASide(): PickASideFixture {
  const side = { team: 'none', badge: '–', name: '', record: '', winProb: 0.5, button: '' };
  return {
    venue: '',
    lockCountdown: '',
    title: 'Pick a side',
    explainer: '',
    away: { ...side },
    home: { ...side },
    storylines: [],
  };
}

export function emptyRelive(): ReliveFixture {
  return {
    away: { team: 'none', badge: '–', name: '' },
    home: { team: 'none', badge: '–', name: '' },
    note: '',
    idleHint: '',
    chartLabels: { left: '', middle: '', right: '' },
    fanCount: '0',
  };
}

export function emptyGameDay(): GameDayFixture {
  return {
    team: 'none',
    matchup: '',
    when: '',
    seat: [],
    companions: [],
    companionsText: '',
    timeline: [],
  };
}

export function emptyGuide(): GuideFixture {
  return {
    team: 'none',
    shape: 'ballparkA',
    venue: '',
    subtitle: '',
    visitors: [],
    visitorsText: '',
    // The tabs are the screen's own chrome rather than content, so they stay: the segmented
    // control is still the thing that would filter a real guide.
    tabs: [
      { key: 'food', label: 'Food' },
      { key: 'bath', label: 'Bathrooms' },
      { key: 'seats', label: 'Seats' },
    ],
  };
}

export function emptyProfile(): ProfileFixture {
  return {
    team: 'none',
    handle: '',
    avatar: '',
    name: '',
    tagline: '',
    teamChips: [],
    stats: [],
    facepile: [],
    rows: [],
  };
}

export const emptyRepository: Repository = {
  passportPills: () => [{ key: 'all', label: 'All Teams', count: '0', team: 'none' }],
  passport: () => emptyPassport(),
  stamps: () => [],
  gameLog: () => null,
  games: () => [],
  pickASide: () => emptyPickASide(),
  relive: () => emptyRelive(),
  reliveSteps: () => [],
  reliveWinProb: () => [],
  relivePhotos: () => [],
  reliveFanPhotos: () => [],
  gameDay: () => emptyGameDay(),
  guide: () => emptyGuide(),
  guideRows: () => [],
  profile: () => emptyProfile(),
  friends: () => ({
    tabs: ['With', 'Following', 'Rivals'],
    note: 'Your record when you go together',
    people: [],
    rivalry: null,
    overlap: null,
  }),
};
