/**
 * How a well-used stamp wears, as geometry.
 *
 * A seal struck many times looks like a passport page stamped too often: the die landed a
 * second time a few degrees off, the ink pooled on the rim, and grit on the pad left specks
 * where no ink took. All of it is worked out here from a seed, the venue id, so the same
 * stadium wears the same way on every render and on every screen. Nothing is random at draw
 * time, so a seal never shimmers when a list re-renders.
 *
 * Coordinates are in the seal's own 100 by 100 view box, centred on (50, 50).
 */

/** 0 is crisp, 1 is lightly worn, 2 is heavily worn and over-inked. */
export type WearLevel = 0 | 1 | 2;

export type Speck = { cx: number; cy: number; r: number };

export type WearMarks = {
  /** Small gaps in the ink, drawn in the disc's own colour over the engraving. */
  specks: Speck[];
  /** Pooled ink on the rim. Heavy wear only. */
  blots: Speck[];
  /** The second strike: the ring drawn again, turned and nudged. Null on a crisp seal. */
  ghost: { rotate: number; dx: number; dy: number; opacity: number } | null;
  /** Added to every engraved stroke width. Over-inking thickens the lines. */
  swell: number;
  /** Stroke put round the ring text so the letters fill in a little. 0 for none. */
  textBleed: number;
};

const CRISP: WearMarks = { specks: [], blots: [], ghost: null, swell: 0, textBleed: 0 };

/** FNV-1a over the seed's UTF-16 units: a stable 32-bit number for any string. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded generator, 0 to 1. Plenty for placing a few specks. */
function generator(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

function scatter(
  next: () => number,
  count: number,
  radius: readonly [number, number],
  size: readonly [number, number],
): Speck[] {
  return Array.from({ length: count }, () => {
    const angle = next() * Math.PI * 2;
    const distance = radius[0] + next() * (radius[1] - radius[0]);
    return {
      cx: round(50 + Math.cos(angle) * distance),
      cy: round(50 + Math.sin(angle) * distance),
      r: round(size[0] + next() * (size[1] - size[0])),
    };
  });
}

export function wearMarks(seed: string, level: WearLevel): WearMarks {
  if (level === 0) return CRISP;
  const next = generator(hash(seed));
  // Left or right, never near zero: a second strike that lands dead on is not visible.
  const turn = (next() < 0.5 ? -1 : 1) * (level === 2 ? 3.5 + next() * 3.5 : 1.5 + next() * 1.5);
  const ghost = {
    rotate: round(turn),
    dx: round((next() - 0.5) * (level === 2 ? 3.2 : 1.6)),
    dy: round((next() - 0.5) * (level === 2 ? 3.2 : 1.6)),
    opacity: level === 2 ? 0.34 : 0.16,
  };
  if (level === 1) {
    return {
      // Kept to the ring text and the two inner rules, where a gap in the ink is seen.
      specks: scatter(next, 7, [21, 37], [0.45, 0.95]),
      blots: [],
      ghost,
      swell: 0,
      textBleed: 0,
    };
  }
  return {
    specks: scatter(next, 17, [6, 38], [0.55, 1.5]),
    blots: scatter(next, 4, [39.4, 40.6], [1.1, 2.1]),
    ghost,
    swell: 0.7,
    textBleed: 0.4,
  };
}
