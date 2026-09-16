/**
 * The app half of the visual parity marker contract. The harness half, including the
 * pixel layout and why it exists at all, is documented in scripts/parity/marker.mjs.
 *
 * Keep hash16 byte-for-byte equivalent to the one there. A change to either without the
 * other makes every screen report as "not built", which is at least a loud failure.
 */

export const MARKER_TOP_PT = 4;
export const MARKER_HEIGHT_PT = 2;
export const MARKER_CELL_PT = 2;
export const MARKER_BITS = 16;
export const MARKER_SENTINEL = '#FF00FF';

/** FNV-1a folded to 16 bits. Mirrors hash16() in scripts/parity/marker.mjs. */
export function hash16(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ((h >>> 16) ^ (h & 0xffff)) & 0xffff;
}

/** Most significant bit first, matching the harness's read order. */
export function markerBits(screenId: string): boolean[] {
  const value = hash16(screenId);
  const bits: boolean[] = [];
  for (let b = MARKER_BITS - 1; b >= 0; b--) bits.push(((value >> b) & 1) === 1);
  return bits;
}

/**
 * The self-test screen's id and fill colour. The colour is one no screen uses, so the
 * harness can find its first row unambiguously and report the safe-area top inset.
 */
export const SELFTEST_ID = 'parity-selftest' as const;
export const SELFTEST_INK = '#00FF7F';
