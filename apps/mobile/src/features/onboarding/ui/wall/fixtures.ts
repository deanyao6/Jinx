/**
 * Every card on the wall that is not a game, as data: the copy from `design/welcome-reference.html`,
 * verbatim. Edit here without touching a component. The six game cards are the only ones that
 * change (types.ts, fallback.ts); everything below is fixed.
 *
 * `columns.ts` says where each one sits.
 */

export type SealSpec = { kind: 'seal'; ring: string; shape: string; metal: 'brass' | 'silver' };
export type StubSpec = { kind: 'stub'; team: string; sec: string; row: string; seat: string };
export type MomentSpec = { kind: 'moment'; tag: string; line: string; sub: string };
export type PhotoSpec = { kind: 'photo'; scene: 'field' | 'board'; sky: string; caption: string };
export type BuddySpec = {
  kind: 'buddy';
  name: string;
  line: string;
  record: string;
  color: string;
  tone: 'good' | 'bad';
};
export type PledgeSpec = { kind: 'pledge'; team: string; odds: string; delta: string };
export type LiveSpec = { kind: 'live' };
export type StreakSpec = { kind: 'streak' };
export type GhostSpec = { kind: 'ghost'; name: string; shape: string };
export type WrappedSpec = { kind: 'wrapped' };
export type GameSlot = { kind: 'game'; index: number };

export type WallCardSpec =
  | SealSpec
  | StubSpec
  | MomentSpec
  | PhotoSpec
  | BuddySpec
  | PledgeSpec
  | LiveSpec
  | StreakSpec
  | GhostSpec
  | WrappedSpec
  | GameSlot;

export const LIVE = {
  status: 'LIVE, TOP 3RD',
  line: 'Padres 1, Dodgers 2',
  sub: 'Dodger Stadium, you are checked in',
} as const;

export const STREAK = {
  tag: 'CURRENT STREAK',
  line: '4 wins in a row',
  sub: 'since Aug 9',
  marks: 'W W W W',
} as const;

export const WRAPPED = {
  tag: 'SEASON WRAPPED',
  year: '2025',
  sub: '18 games, 6 stadiums,\nbest month: August',
} as const;

export const PLEDGE = { tag: 'NEUTRAL GAME', prefix: 'Backed the ', suffix: ', underdog' } as const;

export const STUB = { admit: 'ADMIT ONE' } as const;

export const GHOST = { caption: 'STAMP NOT YET EARNED' } as const;

/** The reference's `buddy()` writes the second line from the tone, not from an argument. */
export const BUDDY_LINE = { good: 'never lost together', bad: '0 for the last 4' } as const;
