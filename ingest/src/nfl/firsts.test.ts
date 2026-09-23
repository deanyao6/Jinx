import { describe, expect, it } from 'vitest';

import { canKnowFirst, PBP_FLOOR } from './firsts.js';

/**
 * Dean found this on his own passport on 2026-09-23: a badge said he saw DeVonta Smith's first
 * touchdown at Eagles at Titans, but Smith is a 2021 rookie and it was only his first of 2026.
 * The daily job reads the current season alone, and the old guard let any player through whose
 * rookie season was after 2000, so every season's first touchdown looked like a career first.
 */
describe('canKnowFirst', () => {
  it('is false when the player debuted before the scan starts', () => {
    // DeVonta Smith, 2021 rookie, in the daily run over 2026 alone.
    expect(canKnowFirst(2021, 2026)).toBe(false);
  });

  it('is true for a player whose rookie season is the one being scanned', () => {
    expect(canKnowFirst(2026, 2026)).toBe(true);
  });

  it('is true once the scan reaches back past the debut', () => {
    expect(canKnowFirst(2021, PBP_FLOOR)).toBe(true);
  });

  it('is false before the play-by-play begins, however far back the scan asks', () => {
    // The data does not exist, so an earlier touchdown may be invisible either way.
    expect(canKnowFirst(1996, 1990)).toBe(false);
    expect(canKnowFirst(PBP_FLOOR - 1, PBP_FLOOR)).toBe(false);
  });

  it('is false when the rookie season is unknown', () => {
    expect(canKnowFirst(null, PBP_FLOOR)).toBe(false);
    expect(canKnowFirst(undefined, PBP_FLOOR)).toBe(false);
  });
});
