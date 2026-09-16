/**
 * The shapes the repository returns.
 *
 * These are re-exported from the demo fixtures rather than redeclared, because the
 * fixtures were written by copying the reference's own sample data and their shape is
 * therefore the shape the screens actually need. When the Supabase implementation lands it
 * maps onto these, so the types stay the contract rather than a description of one
 * implementation.
 */
import type { GAME_DAY, GUIDE, PICK_A_SIDE, PROFILE, RELIVE } from '@/features/demo/fixtures';

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

/**
 * Declared here rather than derived from the demo constant.
 *
 * The fixtures are `as const`, so deriving from them gave the contract literal types —
 * `count: '48' | '17' | '8'` — which the demo implementation satisfied and no real one
 * ever could. A contract shaped by one of its implementations is not a contract.
 */
export type TeamPill = {
  /** Identifies the pill. A team id from the database, or 'all'. */
  key: string;
  label: string;
  /** Rendered as-is, so the caller decides how a count is formatted. */
  count: string;
  /** The theme key, which is a team id, 'none', or one of the reference's short keys. */
  team: string;
};
export type PickASideFixture = typeof PICK_A_SIDE;
export type ReliveFixture = typeof RELIVE;
export type GameDayFixture = typeof GAME_DAY;
export type GuideFixture = typeof GUIDE;
export type ProfileFixture = typeof PROFILE;
/**
 * Declared rather than derived from the demo constant, for the same reason as
 * {@link TeamPill}: the fixture is `as const`, and a contract shaped by one of its
 * implementations is not a contract.
 *
 * The rivalry and overlap cards are nullable because a real user may have neither, and
 * the panel omits the card rather than rendering an empty one.
 */
export type FriendsFixture = {
  readonly tabs: readonly string[];
  note: string;
  people: readonly {
    key: string;
    name: string;
    team: string;
    teamName: string;
    sub: string;
    record: string;
    tone: string;
  }[];
  rivalry: {
    team: string;
    label: string;
    you: { team: string; score: string; label: string };
    them: { score: string; label: string };
    middle: string;
  } | null;
  overlap: { label: string; text: string } | null;
};
