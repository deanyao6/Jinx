import { BUDDY_LINE, type WallCardSpec } from './fixtures';

/**
 * The three columns of the wall, in the reference's order (`COL1`, `COL2`, `COL3` in
 * `design/welcome-reference.html`). A `game` entry is a slot for the payload's card of that
 * rank; everything else is fixed. Nothing here is shuffled, seeded or dated: two launches with
 * the same six cards draw the same wall.
 */
export const COLUMNS: readonly (readonly WallCardSpec[])[] = [
  [
    { kind: 'game', index: 0 },
    { kind: 'seal', ring: 'CITIZENS BANK PARK', shape: 'ballparkA', metal: 'brass' },
    { kind: 'stub', team: 'EAGLES', sec: '121', row: '14', seat: '7' },
    { kind: 'moment', tag: 'MOMENT', line: 'Walk-off, 9th', sub: 'You were there, 3 rows up' },
    { kind: 'photo', scene: 'field', sky: '#1D2B53', caption: 'Section 321 with Dad' },
    {
      kind: 'buddy',
      name: 'Dad',
      line: BUDDY_LINE.good,
      record: '7–1',
      color: '#6E9E7A',
      tone: 'good',
    },
    { kind: 'game', index: 1 },
  ],
  [
    { kind: 'live' },
    { kind: 'stub', team: 'PHILLIES', sec: '104', row: '8', seat: '12' },
    { kind: 'game', index: 2 },
    { kind: 'seal', ring: 'DODGER STADIUM', shape: 'dodger', metal: 'silver' },
    { kind: 'pledge', team: 'Rockies', odds: '37%', delta: '+0.63' },
    { kind: 'ghost', name: 'WRIGLEY FIELD', shape: 'ballparkA' },
    { kind: 'game', index: 3 },
    { kind: 'photo', scene: 'board', sky: '#241B2E', caption: 'Final, 6–3' },
  ],
  [
    { kind: 'streak' },
    { kind: 'game', index: 4 },
    { kind: 'seal', ring: 'LINCOLN FINANCIAL', shape: 'bowl', metal: 'brass' },
    { kind: 'wrapped' },
    { kind: 'game', index: 5 },
    {
      kind: 'buddy',
      name: 'Jordan',
      line: BUDDY_LINE.bad,
      record: '0–4',
      color: '#9E6E6E',
      tone: 'bad',
    },
    { kind: 'moment', tag: 'MOMENT', line: '19°F, coldest yet', sub: 'Eagles vs Cowboys, 2022' },
    { kind: 'seal', ring: 'SOFI STADIUM', shape: 'canopy', metal: 'silver' },
  ],
];

/**
 * Motion per column, from the reference CSS: `.c1{animation:up 34s}`, `.c2{down 44s}`,
 * `.c3{up 26s}`. Linear, infinite, and each starts at phase zero on mount.
 */
export const COLUMN_MOTION: readonly { direction: 'up' | 'down'; durationMs: number }[] = [
  { direction: 'up', durationMs: 34_000 },
  { direction: 'down', durationMs: 44_000 },
  { direction: 'up', durationMs: 26_000 },
];

/** How many game slots the three columns hold between them. */
export const GAME_SLOTS = COLUMNS.flat().filter((c) => c.kind === 'game').length;
