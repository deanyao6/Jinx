/**
 * Easter eggs, one switch each.
 *
 * An egg is a small surprise on top of something that already works, so turning one off must
 * leave the thing under it exactly as it was: with both stamp eggs off a seal is simply
 * team-coloured and crisp. Keep this a plain object of booleans. A new egg adds a key here
 * and reads it where it draws, and nothing else needs to know.
 */
export const eggs = {
  /** A stadium visited many times wears its stamp down: `stampWear` in ./stamps. */
  wornStamps: true,
  /** A stadium where something rare was witnessed is struck in gold: `RARE_MOMENTS` in ./stamps. */
  goldenStamps: true,
  /** Hold the big record on the Passport and it rewinds to 0 and replays, game by game. */
  recordRewind: true,
  /** Ending a personal losing streak of five or more shatters a mirror over the record. */
  curseBreaker: true,
  /** Checked in, behind late: shake (or hold the wordmark) and JINX flips until the final. */
  rallyCap: true,
  /** Open the app at the sport's signature break while checked in, once per game. */
  stretchConfetti: true,
  /** A companion with a bad enough record with you is a certified jinx. */
  certifiedJinx: true,
  /** Two friends checked in at one game tap each other's avatar for a shared card. */
  secretHandshake: true,
} as const;

export type EggKey = keyof typeof eggs;
