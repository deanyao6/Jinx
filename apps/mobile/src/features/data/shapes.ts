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
/**
 * The remaining screens' shapes, declared rather than derived from the demo constants for
 * the same reason as {@link TeamPill}.
 *
 * They were `typeof PICK_A_SIDE` and friends, which made the fixtures' literal strings the
 * type — `venue: 'At Petco Park'`, `fanCount: '23'` — so the only value that satisfied the
 * contract was the fixture itself. A real implementation, and an empty one, could not be
 * written at all. Widening them is what lets a screen be served something other than the
 * reference's sample data.
 */
export type PickASideSide = {
  /** Theme key: a team id, or one of the reference's short keys. */
  team: string;
  badge: string;
  name: string;
  /** The season record under the badge. Empty when it is not known. */
  record: string;
  winProb: number;
  button: string;
};

export type PickASideFixture = {
  venue: string;
  lockCountdown: string;
  title: string;
  explainer: string;
  away: PickASideSide;
  home: PickASideSide;
  storylines: readonly { text: string; source: string }[];
};

export type ReliveTeam = { team: string; badge: string; name: string };

export type ReliveFixture = {
  away: ReliveTeam;
  home: ReliveTeam;
  note: string;
  idleHint: string;
  chartLabels: { left: string; middle: string; right: string };
  fanCount: string;
};

export type GameDayFixture = {
  team: string;
  /**
   * The real game behind the plan, for the share card. Absent on the reference fixture,
   * which is prose with no game behind it.
   */
  game?: { id: string; sport: string; scheduledStart: string; venue: string | null };
  matchup: string;
  when: string;
  seat: readonly { label: string; value: string }[];
  /** Avatar keys or person ids. */
  companions: readonly string[];
  companionsText: string;
  timeline: readonly { icon: string; time: string; text: string; now: boolean }[];
};

export type GuideFixture = {
  team: string;
  shape: string;
  venue: string;
  subtitle: string;
  visitors: readonly string[];
  visitorsText: string;
  tabs: readonly { key: string; label: string }[];
};

/**
 * Who an avatar key stands for, when it stands for a real person (SPEC.md 8.6).
 *
 * The fixtures carry avatars as bare keys: a fixture name in demo mode, a person or user id in
 * real data. `Repository.person(key)` resolves a real one to this; in demo mode it returns null
 * and the screen draws the reference's fixture art instead.
 */
export type PersonRef = {
  /**
   * A stable id for the person: their account when they have one, else the placeholder's person
   * id ("Dad"). It seeds the generated colour, so someone is the same colour on every screen.
   */
  userId: string | null;
  name: string | null;
  handle: string | null;
  /** `profiles.avatar_path`, or null for the generated default. */
  avatarPath: string | null;
};

export type ProfileFixture = {
  team: string;
  handle: string;
  /** Avatar key: a person id in real data, a fixture name in demo mode. */
  avatar: string;
  name: string;
  tagline: string;
  teamChips: readonly { team: string; label: string }[];
  stats: readonly { value: string; label: string }[];
  facepile: readonly string[];
  rows: readonly { icon: string; title: string; meta: string; facepile: boolean }[];
};
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
    /**
     * The certified jinx egg (`features/eggs/jinx`): at most one 'jinx' and one 'charm' on the
     * list. Only the signed-in person's own records set it; the demo fixture never does.
     */
    luck?: 'jinx' | 'charm';
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
