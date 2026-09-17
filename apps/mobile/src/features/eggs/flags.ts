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
} as const;

export type EggKey = keyof typeof eggs;
