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

/**
 * Pick a side (SPEC.md 8.8.3). The countdown is the value the reference's markup starts
 * with, frozen: the harness stops the reference's timer, so this is what it displays.
 */
export const PICK_A_SIDE = {
  venue: 'At Petco Park',
  lockCountdown: '12:34',
  title: 'Pick a side',
  explainer:
    "You don't follow either team. Pick who you're rooting for. It counts toward your neutral record.",
  away: {
    team: 'nym',
    badge: 'NYM',
    name: 'Mets',
    record: '68–54',
    winProb: 0.58,
    button: 'Root for NY Mets',
  },
  home: {
    team: 'sd',
    badge: 'SD',
    name: 'Padres',
    record: '70–53',
    winProb: 0.42,
    button: 'Root for SD Padres',
  },
  storylines: [
    { text: 'Mets look to extend a 4-game winning streak on the road.', source: 'FROM RESULTS' },
    {
      text: 'Padres probable starter makes his first start of the season.',
      source: 'PROBABLE STARTERS',
    },
  ],
} as const;

/**
 * The confirmation line, built the way the reference's click handler builds it: the gain
 * is 1 minus the probability the picked side was given, to two decimals.
 */
export function pickConfirmation(teamName: string, winProb: number): string {
  return (
    `You're rooting for the ${teamName}. Switch anytime before it locks. ` +
    `A win adds +${(1 - winProb).toFixed(2)} to your neutral record vs expected.`
  );
}

/**
 * Relive (SPEC.md 6.19, 8.8.4). The win probability series and the story steps are the
 * reference's `WP` and `STEPS` arrays verbatim.
 */
export const RELIVE = {
  away: { team: 'nym', badge: 'NYM', name: 'Mets' },
  home: { team: 'phi', badge: 'PHI', name: 'Phillies' },
  note: 'Aug 14, 2025, Citizens Bank Park, Section 321 with Dad and Maya',
  idleHint: 'Tap play to relive it',
  chartLabels: { left: '1st', middle: 'Phillies win probability', right: '9th' },
  fanCount: '23',
} as const;

/** `WP` in the reference: the home team's win probability at each point. */
export const RELIVE_WP: readonly number[] = [
  0.55, 0.53, 0.49, 0.44, 0.47, 0.62, 0.6, 0.58, 0.5, 0.52, 0.56, 0.86, 0.88, 0.87, 0.84, 0.95,
  0.96, 1,
];

export type ReliveStep = {
  /** Index into RELIVE_WP that this step sits on. */
  wp: number;
  score: string;
  label: string;
  text: string;
};

/** `STEPS` in the reference. */
export const RELIVE_STEPS: readonly ReliveStep[] = [
  { wp: 0, score: '0 – 0', label: 'Pregame', text: 'Phillies were 55% to win before first pitch.' },
  { wp: 3, score: '1 – 0', label: 'Top 2nd', text: 'Mets score first on a sacrifice fly.' },
  {
    wp: 5,
    score: '1 – 2',
    label: 'Bottom 3rd',
    text: 'Two-run double puts the Phillies ahead. First high five with Dad.',
  },
  { wp: 8, score: '2 – 2', label: 'Top 5th', text: 'Solo homer to left ties it.' },
  {
    wp: 11,
    score: '2 – 5',
    label: 'Bottom 6th',
    text: 'Three-run homer into the seats below Section 321.',
  },
  { wp: 14, score: '3 – 5', label: 'Top 8th', text: 'Mets get one back with two outs.' },
  { wp: 15, score: '3 – 6', label: 'Bottom 8th', text: 'Insurance run on a bases-loaded walk.' },
  {
    wp: 17,
    score: '3 – 6',
    label: 'Final',
    text: 'Phillies win. Your record with Dad goes to 7–1.',
  },
];

/**
 * A point on the chart, from `pt()` in the reference: the series is spread across a
 * 300x92 viewBox with a 4pt inset on the left and the probability mapped to 84 of the
 * 92 units.
 */
export function relivePoint(i: number): readonly [number, number] {
  const wp = RELIVE_WP[i] ?? 0;
  return [(i / (RELIVE_WP.length - 1)) * 292 + 4, 88 - wp * 84];
}

/** The placeholder photo scenes, from `scene()` in the reference. */
export const PHOTO_SKIES: readonly string[] = ['#1D2B53', '#243B6B', '#3B2C5A'];
export const RELIVE_YOUR_PHOTOS = [
  { kind: 'selfie', seed: 0 },
  { kind: 'field', seed: 1 },
] as const;
export const RELIVE_FAN_PHOTOS = [
  { kind: 'board', seed: 0 },
  { kind: 'field', seed: 2 },
  { kind: 'selfie', seed: 2 },
] as const;

/** Game day plan (SPEC.md 8.8.5). A demo shell in v1, behind FEATURE_PLAN. */
export const GAME_DAY = {
  team: 'phl',
  matchup: 'Eagles at Rams',
  when: 'Sunday, 1:25 PM, SoFi Stadium',
  seat: [
    { label: 'Section', value: '121' },
    { label: 'Row', value: '14' },
    { label: 'Seat', value: '7' },
    { label: 'Gate', value: '3' },
  ],
  companions: ['dean', 'maya', 'jordan'],
  companionsText: 'Going with Maya and Jordan',
  timeline: [
    { icon: 'i-car', time: '9:45 AM', text: 'Leave home. 41 min with Sunday traffic.', now: true },
    {
      icon: 'i-grill',
      time: '10:30 AM',
      text: 'Park in Lot L. Eagles fans tailgate at the north end.',
      now: false,
    },
    {
      icon: 'i-gate',
      time: '12:40 PM',
      text: 'Enter at Gate 3, the shortest line for Section 121.',
      now: false,
    },
    {
      icon: 'i-flag',
      time: '5:30 PM',
      text: 'Post-game at an Eagles bar in Santa Monica. 34 fans going.',
      now: false,
    },
  ],
} as const;

/** Stadium guide (SPEC.md 8.8.6). A demo shell in v1, behind FEATURE_GUIDE. */
export const GUIDE = {
  team: 'phi',
  shape: 'ballparkA',
  venue: 'Citizens Bank Park',
  subtitle: 'Philadelphia, home of the Phillies',
  visitors: ['maya', 'dad', 'priya'],
  visitorsText: 'You and 12 friends visited',
  tabs: [
    { key: 'food', label: 'Food' },
    { key: 'bath', label: 'Bathrooms' },
    { key: 'seats', label: 'Seats' },
  ],
} as const;

export type GuideRow = { icon: string; title: string; meta: string; score: string };

export const GUIDE_ROWS: Record<string, readonly GuideRow[]> = {
  food: [
    {
      icon: 'i-food',
      title: 'Cheesesteak',
      meta: 'Stand near Section 104, 6 min line',
      score: '9.2',
    },
    { icon: 'i-food', title: 'Crab fries', meta: 'Outfield concourse', score: '8.7' },
    { icon: 'i-food', title: 'Roast pork sandwich', meta: 'Behind Section 141', score: '8.4' },
    { icon: 'i-food', title: 'Soft pretzel', meta: 'Carts on every level', score: '7.1' },
    { icon: 'i-food', title: 'Nachos helmet', meta: 'Section 120', score: '5.8' },
  ],
  bath: [
    { icon: 'i-door', title: 'Near Section 132', meta: 'Cleanest, about 2 min wait', score: '9.0' },
    { icon: 'i-door', title: 'Upper deck, 320s', meta: 'Quiet after the 6th', score: '8.1' },
    { icon: 'i-door', title: 'Main gate concourse', meta: 'Avoid between innings', score: '4.3' },
  ],
  seats: [
    {
      icon: 'i-seat',
      title: 'Section 321, rows 1–5',
      meta: 'Skyline view, shaded late',
      score: '9.1',
    },
    { icon: 'i-seat', title: 'Section 104', meta: 'Close to the bullpen', score: '8.6' },
    { icon: 'i-seat', title: 'Section 142', meta: 'Full sun at day games', score: '6.2' },
  ],
};

/** `circCls()` in the reference: green at 8 and above, amber at 6, red below. */
export function scoreClass(score: string): 's-hi' | 's-mid' | 's-lo' {
  const n = parseFloat(score);
  return n >= 8 ? 's-hi' : n >= 6 ? 's-mid' : 's-lo';
}

/** Profile (SPEC.md 8.8.7). */
export const PROFILE = {
  team: 'phi',
  handle: '@deanyao',
  avatar: 'dean',
  name: 'Dean Yao',
  tagline: 'Philly fan in Los Angeles',
  teamChips: [
    { team: 'phi', label: 'Phillies' },
    { team: 'phl', label: 'Eagles' },
  ],
  stats: [
    { value: '48', label: 'Games' },
    { value: '14', label: 'Stadiums' },
    { value: '132', label: 'Followers' },
    { value: '98', label: 'Following' },
  ],
  facepile: ['dad', 'maya', 'jordan'],
  rows: [
    { icon: 'i-users', title: 'Friends', meta: 'Companions, rivals, overlaps', facepile: true },
    { icon: 'i-target', title: '2026 goals', meta: '2 of 3 in progress', facepile: false },
    { icon: 'i-map', title: 'Map', meta: '14 stadiums, 3 countries', facepile: false },
    { icon: 'i-spark', title: '2025 Wrapped', meta: 'MLB and NFL', facepile: false },
  ],
} as const;

/** The Friends slide-over (SPEC.md 8.8.8). */
export const FRIENDS = {
  tabs: ['With', 'Following', 'Rivals'],
  note: 'Your record when you go together',
  people: [
    {
      key: 'dad',
      name: 'Dad',
      team: 'phi',
      teamName: 'Phillies',
      sub: '11 games together',
      record: '7–1',
      tone: 'good',
    },
    {
      key: 'maya',
      name: 'Maya Chen',
      team: 'phi',
      teamName: 'Phillies',
      sub: '6 games together',
      record: '4–2',
      tone: 'ink',
    },
    {
      key: 'priya',
      name: 'Priya Nair',
      team: 'lad',
      teamName: 'Dodgers',
      sub: '4 games together',
      record: '3–1',
      tone: 'ink',
    },
    {
      key: 'jordan',
      name: 'Jordan Ellis',
      team: 'nym',
      teamName: 'Mets',
      sub: '4 games together',
      record: '0–4',
      tone: 'bad',
    },
  ],
  rivalry: {
    team: 'nym',
    label: 'Rivalry with Jordan, Mets fan',
    you: { team: 'phi', score: '5', label: 'You' },
    them: { score: '3', label: 'Jordan' },
    middle: 'Head to head',
  },
  overlap: {
    label: 'Before you connected',
    text: 'You and Maya were both at Phillies vs Mets in August 2019, eleven sections apart.',
  },
} as const;
