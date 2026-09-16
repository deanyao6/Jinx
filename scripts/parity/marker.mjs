// How the app tells the harness which screen it actually rendered.
//
// `simctl openurl` succeeds whether or not the app understands the URL, so without a
// signal from inside the app the harness will happily screenshot whatever happens to be
// on screen and report a confident, meaningless percentage. It did exactly that on its
// first run: 32 shots of the sign-in screen, scored against 32 different references.
//
// So in parity mode the app paints a marker strip into the top of the window, inside the
// TOP_CROP_PT band that the harness crops away before comparing. The marker is therefore
// invisible to the diff and present in the raw screenshot.
//
// Layout, in raw pixels from the top-left of the screenshot:
//   row band     y = MARKER_Y .. MARKER_Y + MARKER_H
//   cell 0       sentinel, pure magenta (255, 0, 255)
//   cells 1..16  one bit each, white = 1, black = 0, most significant bit first
// Each cell is CELL_W pixels wide. The 16 bits are hash16(screen.id).
//
// The app side of this contract lives in the parity route wrapper; see
// design/PORTING_NOTES.md. A screen without the marker is reported as "not built"
// rather than diffed.

export const MARKER_Y = 12;
export const MARKER_H = 6;
export const CELL_W = 6;
export const BITS = 16;
export const SENTINEL = [255, 0, 255];

/** FNV-1a, folded to 16 bits. Must match the app's implementation exactly. */
export function hash16(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ((h >>> 16) ^ (h & 0xffff)) & 0xffff;
}

function sampleCell(png, index) {
  // Sample the middle of the cell, away from any antialiased edge.
  const x = index * CELL_W + Math.floor(CELL_W / 2);
  const y = MARKER_Y + Math.floor(MARKER_H / 2);
  const i = (y * png.width + x) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}

/**
 * Decoding is relative, not absolute.
 *
 * iOS composites things over the app that scale every pixel uniformly: a system alert
 * dims the screen behind it to 80%, and so do several other transient states. An exact
 * match against (255, 0, 255) fails in all of them, and the failure looks exactly like
 * "the app did not render this screen", which sent me chasing the wrong bug once
 * already.
 *
 * So the sentinel establishes the reference level for this screenshot, and the bit cells
 * are read against that level. Any uniform brightness change cancels out.
 */
function isSentinel(px) {
  const [r, g, b] = px;
  const high = Math.max(r, b);
  return high >= 80 && g <= high * 0.35 && Math.abs(r - b) <= high * 0.25;
}

export function readMarker(png) {
  if (png.height < MARKER_Y + MARKER_H) return { present: false };
  const sentinel = sampleCell(png, 0);
  if (!isSentinel(sentinel)) return { present: false };

  // The sentinel is drawn at full channel value, so its brighter channel is this
  // screenshot's "1" level. Bits are then a clean two-way split around half of it.
  const level = Math.max(sentinel[0], sentinel[2]);
  const mid = level / 2;

  let value = 0;
  for (let b = 0; b < BITS; b++) {
    const px = sampleCell(png, b + 1);
    const mean = (px[0] + px[1] + px[2]) / 3;
    // A cell sitting near the midpoint is not a confident bit; treat the whole marker
    // as absent rather than return a wrong id.
    if (Math.abs(mean - mid) < level * 0.15) return { present: false };
    value = (value << 1) | (mean > mid ? 1 : 0);
  }
  return { present: true, value };
}
