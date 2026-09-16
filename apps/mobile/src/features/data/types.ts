import type {
  GameDayFixture,
  GameLogFixture,
  GameRowFixture,
  GuideFixture,
  GuideRow,
  PassportFixture,
  PickASideFixture,
  ProfileFixture,
  FriendsFixture,
  ReliveFixture,
  PhotoRef,
  ReliveStep,
  StampFixture,
  TeamPill,
} from './shapes';

/**
 * How settled the repository is.
 *
 * `loading` means the user's own data is on its way; `ready` means it arrived, even when
 * what arrived is nothing. A screen shows the same empty layout for both and says which,
 * so an empty passport is never mistaken for a slow one. `demo` is the SPEC.md 8.9 build
 * flag serving the reference's fixture account.
 */
export type RepositoryStatus = 'loading' | 'ready' | 'demo';

/**
 * What a screen needs, independent of where it comes from (SPEC.md 8.9).
 *
 * Supabase, empty and demo are three implementations of this, so a screen never learns
 * which one it is talking to and swapping them touches no UI code. A signed-in user always
 * gets the Supabase one; the parity harness gets the demo one, behind the `EXPO_PUBLIC_DEMO`
 * build flag, because it reproduces the reference's sample data exactly and that is what
 * makes a pixel comparison meaningful at all.
 *
 * Every method is synchronous and total. The screens render a settled state, and the real
 * implementation returns already-fetched query data rather than promises, so loading and
 * error states belong to the provider above rather than to this interface.
 *
 * **A known design flaw, found while wiring M5.** This interface serves the *current
 * user's aggregate* data — their records, their stamps, their games. The per-game methods
 * below (`pickASide`, `relive*`) do not fit that: they need a game id, and a synchronous
 * method cannot serve one unless that game is already loaded into the implementation.
 *
 * They belong on their own per-game hooks rather than here. The mapping functions for both
 * exist and are tested in `supabase.ts`; what is missing is moving the two screens onto
 * `useGameContext(gameId)` and `useGameStorySteps(gameId)` directly. Until that happens they
 * return empty — not fixtures — and each screen shows its empty state, which is why neither
 * appears in `SUPABASE_BACKED`.
 */
export type Repository = {
  /** The team filter pills on Passport, with their game counts. */
  passportPills(): readonly TeamPill[];
  /** Everything the Passport screen shows for one pill. */
  passport(pill: string): PassportFixture;
  /** The stamps for one pill, already filtered. */
  stamps(pill: string): readonly StampFixture[];
  /** One record card's game log, or null when that record has none. */
  gameLog(key: string): GameLogFixture | null;
  /** The Games screen's history list. */
  games(): readonly GameRowFixture[];
  pickASide(): PickASideFixture;
  relive(): ReliveFixture;
  /** The story steps, in order. */
  reliveSteps(): readonly ReliveStep[];
  /** The home team's win probability at each point on the chart. */
  reliveWinProb(): readonly number[];
  /** The user's own photos for this attendance, and other fans' public ones. */
  relivePhotos(): readonly PhotoRef[];
  reliveFanPhotos(): readonly PhotoRef[];
  gameDay(): GameDayFixture;
  guide(): GuideFixture;
  guideRows(tab: string): readonly GuideRow[];
  profile(): ProfileFixture;
  friends(): FriendsFixture;
};
