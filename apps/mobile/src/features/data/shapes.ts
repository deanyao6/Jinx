/**
 * The shapes the repository returns.
 *
 * These are re-exported from the demo fixtures rather than redeclared, because the
 * fixtures were written by copying the reference's own sample data and their shape is
 * therefore the shape the screens actually need. When the Supabase implementation lands it
 * maps onto these, so the types stay the contract rather than a description of one
 * implementation.
 */
export type {
  GameLogFixture,
  GameRowFixture,
  GuideRow,
  LogRowFixture,
  PassportFixture,
  RecordCardFixture,
  ShapeKey,
  StampFixture,
  ReliveStep,
  SuperlativeFixture,
} from '@/features/demo/fixtures';

/** One photo on Relive. `kind` chooses the placeholder scene in demo mode. */
export type PhotoRef = { kind: 'selfie' | 'field' | 'board'; seed: number };

import type {
  GAME_DAY,
  GUIDE,
  FRIENDS,
  PICK_A_SIDE,
  PROFILE,
  RELIVE,
  PASSPORT_PILLS,
} from '@/features/demo/fixtures';

export type TeamPill = (typeof PASSPORT_PILLS)[number];
export type PickASideFixture = typeof PICK_A_SIDE;
export type ReliveFixture = typeof RELIVE;
export type GameDayFixture = typeof GAME_DAY;
export type GuideFixture = typeof GUIDE;
export type ProfileFixture = typeof PROFILE;
export type FriendsFixture = typeof FRIENDS;
