/**
 * Demo fixtures (SPEC.md 8.9): the sample data from `design/reference.html`, reproduced
 * exactly so a screen can be compared against the reference pixel for pixel.
 *
 * Every value here is copied from the reference's own JavaScript, not invented. The
 * en-dashes, the thin spaces around them, the upper-case labels and the ordering all
 * matter, because the parity diff sees them. `__tests__/fixtures.test.ts` re-reads the
 * reference and fails if any of it drifts.
 *
 * These are read through the repository interfaces the screens use, so demo data and
 * Supabase are interchangeable without touching a screen (SPEC.md 8.9).
 */

export type StampFixture = {
  name: string;
  city: string;
  /** Text around the seal's ring. */
  ring: string;
  shape: ShapeKey;
  metal: 'brass' | 'silver';
  teams: string[];
};

export type ShapeKey =
  'ballparkA' | 'dodger' | 'wrigley' | 'oracle' | 'bowl' | 'canopy' | 'colonnade';

export type RecordCardFixture = {
  name: string;
  record: string;
  pct: string;
  /** Team key for the card's colours, or 'neutral' for the As a neutral card. */
  team: string;
  /** Which game log this card opens. */
  log: string;
};

export type SuperlativeFixture = {
  icon: string;
  label: string;
  value: string;
  chip: string;
};

export type PassportFixture = {
  teamKey: string;
  label: string;
  badge: string;
  record: string;
  winRate: string;
  streak: string;
  lastGame: string;
  stampCount: string;
  cards: RecordCardFixture[];
  superlatives: SuperlativeFixture[];
};

/** The team filter pills, with their game counts. */
export const PASSPORT_PILLS = [
  { key: 'all', label: 'All Teams', count: '48', team: 'none' },
  { key: 'phi', label: 'Phillies', count: '17', team: 'phi' },
  { key: 'phl', label: 'Eagles', count: '8', team: 'phl' },
] as const;

/**
 * Per-pill passport content. Keyed the way the reference's `P` object is.
 *
 * Note the record strings use an en-dash with thin spaces, e.g. `31 – 17`, exactly as
 * the reference writes them. Substituting a hyphen changes the glyph widths and shows
 * up in the diff.
 */
export const PASSPORT: Record<string, PassportFixture> = {
  all: {
    teamKey: 'none',
    label: 'LIFETIME RECORD',
    badge: '48 GAMES ATTENDED',
    record: '31 – 17',
    winRate: '.646',
    streak: '+3 game win streak',
    lastGame: 'Last Game: PHI 4 – 2 NYM',
    stampCount: 'View All (8)',
    cards: [
      { name: 'Phillies', record: '12 – 5', pct: '.706 pct', team: 'phi', log: 'phi' },
      { name: 'Eagles', record: '6 – 2', pct: '.750 pct', team: 'phl', log: 'phl' },
      { name: 'Neutral', record: '10 – 9', pct: '.526 pct', team: 'neutral', log: 'neutral' },
    ],
    superlatives: [
      { icon: 'i-thermo', label: 'Coldest Recorded Game', value: '-2 °F', chip: 'Linc, Jan 2024' },
      { icon: 'i-user', label: 'Most Seen Player', value: 'Bryce Harper', chip: '11 Games' },
      {
        icon: 'i-speaker',
        label: 'Loudest Stadium Visited',
        value: '98.4 dB',
        chip: 'Citizens Bank',
      },
    ],
  },
  phi: {
    teamKey: 'phi',
    label: 'PHILLIES RECORD',
    badge: '17 GAMES ATTENDED',
    record: '12 – 5',
    winRate: '.706',
    streak: '+2 game win streak',
    lastGame: 'Last Game: PHI 4 – 2 NYM',
    stampCount: 'View All (4)',
    cards: [
      { name: 'Home', record: '9 – 3', pct: '.750 pct', team: 'phi', log: 'phiHome' },
      { name: 'Road', record: '3 – 2', pct: '.600 pct', team: 'phi', log: 'phiRoad' },
      { name: 'With Dad', record: '7 – 1', pct: '.875 pct', team: 'phi', log: 'dad' },
    ],
    superlatives: [
      { icon: 'i-user', label: 'Most Seen Phillie', value: 'Bryce Harper', chip: '11 Games' },
      { icon: 'i-clock', label: 'Longest Game', value: '4:41', chip: '13 inn, 2023' },
      { icon: 'i-bolt', label: 'Walk-offs Witnessed', value: '2', chip: 'Citizens Bank' },
    ],
  },
  phl: {
    teamKey: 'phl',
    label: 'EAGLES RECORD',
    badge: '8 GAMES ATTENDED',
    record: '6 – 2',
    winRate: '.750',
    streak: '+1 game win streak',
    lastGame: 'Last Game: PHI 24 – 27 LAR',
    stampCount: 'View All (3)',
    cards: [
      { name: 'Home', record: '4 – 1', pct: '.800 pct', team: 'phl', log: 'phlHome' },
      { name: 'Road', record: '2 – 1', pct: '.667 pct', team: 'phl', log: 'phlRoad' },
      { name: 'Playoffs', record: '1 – 0', pct: '1.000 pct', team: 'phl', log: 'phlPost' },
    ],
    superlatives: [
      { icon: 'i-thermo', label: 'Coldest Recorded Game', value: '-2 °F', chip: 'Linc, Jan 2024' },
      { icon: 'i-trend', label: 'Biggest Comeback', value: '+17', chip: 'vs DAL, 2022' },
      { icon: 'i-user', label: 'Most Seen Eagle', value: 'Jalen Hurts', chip: '7 Games' },
    ],
  },
};

/** Stamps, filtered per pill by the `teams` list, exactly as the reference does. */
export const STAMPS: StampFixture[] = [
  {
    name: 'Citizens Bank',
    city: 'PHILADELPHIA',
    ring: 'CITIZENS BANK PARK',
    shape: 'ballparkA',
    metal: 'brass',
    teams: ['all', 'phi'],
  },
  {
    name: 'Lincoln Financial',
    city: 'PHILADELPHIA',
    ring: 'LINCOLN FINANCIAL',
    shape: 'bowl',
    metal: 'brass',
    teams: ['all', 'phl'],
  },
  {
    name: 'Citi Field',
    city: 'NEW YORK',
    ring: 'CITI FIELD',
    shape: 'ballparkA',
    metal: 'silver',
    teams: ['all', 'phi'],
  },
  {
    name: 'Dodger Stadium',
    city: 'LOS ANGELES',
    ring: 'DODGER STADIUM',
    shape: 'dodger',
    metal: 'silver',
    teams: ['all', 'phi'],
  },
  {
    name: 'SoFi Stadium',
    city: 'INGLEWOOD',
    ring: 'SOFI STADIUM',
    shape: 'canopy',
    metal: 'silver',
    teams: ['all', 'phl'],
  },
  {
    name: 'MetLife Stadium',
    city: 'EAST RUTHERFORD',
    ring: 'METLIFE STADIUM',
    shape: 'bowl',
    metal: 'silver',
    teams: ['all', 'phl'],
  },
];

export function stampsFor(pill: string): StampFixture[] {
  return STAMPS.filter((s) => s.teams.includes(pill));
}

/** Seal metal gradients: [highlight, base, engraving]. */
export const METAL: Record<'brass' | 'silver', readonly [string, string, string]> = {
  brass: ['#F3EBD3', '#D9C79C', '#6E5A33'],
  silver: ['#EEF0F2', '#C5CAD0', '#4A5260'],
};

export type GameRowFixture = {
  team: string;
  shape: ShapeKey;
  title: string;
  meta: string;
  /** Avatar keys for the companions shown on the row. */
  withAvatars: string[];
  withText: string;
  result: 'w' | 'l';
};

/** The Games screen's History list. */
export const GAMES: GameRowFixture[] = [
  {
    team: 'phi',
    shape: 'ballparkA',
    title: 'Mets 3, Phillies 5',
    meta: 'Citizens Bank Park, Oct 12, 2024',
    withAvatars: ['jordan', 'sam'],
    withText: 'w/ Alex, Marcus',
    result: 'w',
  },
  {
    team: 'nyg',
    shape: 'bowl',
    title: 'Cowboys 27, Giants 20',
    meta: 'MetLife Stadium, Sep 26, 2024',
    withAvatars: ['maya'],
    withText: 'w/ Sarah',
    result: 'w',
  },
  {
    team: 'lad',
    shape: 'dodger',
    title: 'Phillies 2, Dodgers 5',
    meta: 'Dodger Stadium, May 18, 2024',
    withAvatars: ['priya', 'maya', 'sam'],
    withText: 'w/ Chloe, David +1',
    result: 'l',
  },
  {
    team: 'bos',
    shape: 'wrigley',
    title: 'Yankees 4, Red Sox 6',
    meta: 'Fenway Park, Jun 15, 2024',
    withAvatars: [],
    withText: '',
    result: 'l',
  },
  {
    team: 'lv',
    shape: 'canopy',
    title: 'Chiefs 31, Raiders 17',
    meta: 'Allegiant Stadium, Nov 26, 2023',
    withAvatars: ['dad'],
    withText: 'w/ Dad',
    result: 'w',
  },
];

export type LogRowFixture = {
  team: string;
  shape: ShapeKey;
  title: string;
  meta: string;
  result: 'w' | 'l';
};

export type GameLogFixture = {
  title: string;
  teamKey: string;
  sub: string;
  meta: string;
  more: string;
  rows: LogRowFixture[];
};

const PHI_LOG: GameLogFixture = {
  title: 'Phillies',
  teamKey: 'phi',
  sub: 'Phillies record at games',
  meta: '17 games, .706',
  more: '10 more games',
  rows: [
    {
      team: 'phi',
      shape: 'ballparkA',
      title: 'Phillies 6, Mets 3',
      meta: 'Citizens Bank Park, Aug 14, 2025',
      result: 'w',
    },
    {
      team: 'phi',
      shape: 'ballparkA',
      title: 'Phillies 4, Braves 1',
      meta: 'Citizens Bank Park, Jul 3, 2025',
      result: 'w',
    },
    {
      team: 'lad',
      shape: 'dodger',
      title: 'Phillies 2, Dodgers 5',
      meta: 'Dodger Stadium, May 18, 2025',
      result: 'l',
    },
    {
      team: 'phi',
      shape: 'ballparkA',
      title: 'Phillies 8, Marlins 2',
      meta: 'Citizens Bank Park, Sep 1, 2024',
      result: 'w',
    },
    {
      team: 'sf',
      shape: 'oracle',
      title: 'Phillies 5, Giants 4',
      meta: 'Oracle Park, Jun 9, 2024',
      result: 'w',
    },
    {
      team: 'phi',
      shape: 'ballparkA',
      title: 'Phillies 1, Cubs 3',
      meta: 'Citizens Bank Park, Aug 20, 2023',
      result: 'l',
    },
    {
      team: 'phi',
      shape: 'ballparkA',
      title: 'Phillies 7, Nationals 6',
      meta: 'Citizens Bank Park, 13 innings, 2023',
      result: 'w',
    },
  ],
};

const PHL_LOG: GameLogFixture = {
  title: 'Eagles',
  teamKey: 'phl',
  sub: 'Eagles record at games',
  meta: '8 games, .750',
  more: '3 more games',
  rows: [
    {
      team: 'lar',
      shape: 'canopy',
      title: 'Eagles 24, Rams 27',
      meta: 'SoFi Stadium, Nov 24, 2024',
      result: 'l',
    },
    {
      team: 'phl',
      shape: 'bowl',
      title: 'Eagles 31, Cowboys 28',
      meta: 'Lincoln Financial Field, Dec 2022',
      result: 'w',
    },
    {
      team: 'phl',
      shape: 'bowl',
      title: 'Eagles 38, Giants 7',
      meta: 'Lincoln Financial Field, playoffs, Jan 2023',
      result: 'w',
    },
    {
      team: 'lar',
      shape: 'canopy',
      title: 'Eagles 26, Rams 20',
      meta: 'SoFi Stadium, Sep 2023',
      result: 'w',
    },
    {
      team: 'phl',
      shape: 'bowl',
      title: 'Eagles 17, Commanders 20',
      meta: 'Lincoln Financial Field, Oct 2021',
      result: 'l',
    },
  ],
};

const NEUTRAL_LOG: GameLogFixture = {
  title: 'As a neutral',
  teamKey: 'none',
  sub: 'Record as a neutral',
  meta: '19 games, +2.4 vs expected',
  more: '13 more games',
  rows: [
    {
      team: 'lad',
      shape: 'dodger',
      title: 'Picked Dodgers vs Giants',
      meta: 'Won, picked at 58%, +0.42',
      result: 'w',
    },
    {
      team: 'chi',
      shape: 'colonnade',
      title: 'Picked Bears vs Packers',
      meta: 'Won, picked at 38%, +0.62',
      result: 'w',
    },
    {
      team: 'sf',
      shape: 'oracle',
      title: 'Picked Giants vs Tigers',
      meta: 'Lost, picked at 54%, −0.54',
      result: 'l',
    },
    {
      team: 'lar',
      shape: 'canopy',
      title: 'Picked Rams vs 49ers',
      meta: 'Won, picked at 41%, +0.59',
      result: 'w',
    },
    {
      team: 'lad',
      shape: 'dodger',
      title: 'Picked Padres vs Dodgers',
      meta: 'Lost, picked at 36%, −0.36',
      result: 'l',
    },
    {
      team: 'lar',
      shape: 'canopy',
      title: 'Picked Chargers vs Chiefs',
      meta: 'Lost, picked at 30%, −0.30',
      result: 'l',
    },
  ],
};

/**
 * Every record card opens a log. The reference aliases the Home / Road / companion cards
 * onto the same team log rather than authoring six more, so this does too.
 */
export const GAME_LOGS: Record<string, GameLogFixture> = {
  phi: PHI_LOG,
  phiHome: PHI_LOG,
  phiRoad: PHI_LOG,
  dad: PHI_LOG,
  phl: PHL_LOG,
  phlHome: PHL_LOG,
  phlRoad: PHL_LOG,
  phlPost: PHL_LOG,
  neutral: NEUTRAL_LOG,
};

/** Generated avatar palettes: [skin, hair, background]. */
export const AVATARS: Record<string, readonly [string, string, string]> = {
  dean: ['#F3C9A5', '#2B2118', '#7FB3D5'],
  dad: ['#D9A57A', '#8A8A8A', '#9BC7A6'],
  maya: ['#C98A62', '#3A2317', '#E8B4C8'],
  jordan: ['#8D5A3B', '#1D1D1D', '#F2C26B'],
  priya: ['#B97A55', '#241612', '#A7B8F0'],
  sam: ['#F0CFB0', '#C9772E', '#B5DDD1'],
};
