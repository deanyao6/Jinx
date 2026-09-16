// Measures vertical drift between an app shot and its reference, band by band.
//
// A single mismatch percentage says how much is wrong but not what kind of wrong. Layout
// that is correct but shifted scores the same as layout that is genuinely different, and
// the fix is completely different. This slices the screen into horizontal bands and, for
// each one, finds the vertical offset that best aligns the app with the reference.
//
// A drift that grows steadily down the screen means accumulating line box height. A
// constant offset means one wrong margin near the top. Zero drift with a high mismatch
// means the geometry is right and the difference is colour or type rendering.
//
// Usage: node scripts/parity/drift.mjs passport-all light

import { readPng } from './png.mjs';
import { OUT_DIR, DEVICE } from './geometry.mjs';

const [screen = 'passport-all', theme = 'light'] = process.argv.slice(2);
const BAND = 40 * DEVICE.scale; // 40pt tall bands
const MAX_SHIFT = 24 * DEVICE.scale;

const ref = await readPng(`${OUT_DIR}/reference/${screen}.${theme}.png`);
const app = await readPng(`${OUT_DIR}/app/${screen}.${theme}.png`);
if (ref.width !== app.width || ref.height !== app.height) {
  throw new Error(`size mismatch: ${ref.width}x${ref.height} vs ${app.width}x${app.height}`);
}

/** Mean absolute luma difference between reference band at y and app band at y+shift. */
function cost(y, shift) {
  let total = 0;
  let n = 0;
  for (let dy = 0; dy < BAND; dy += 3) {
    const ry = y + dy;
    const ay = ry + shift;
    if (ay < 0 || ay >= app.height || ry >= ref.height) continue;
    for (let x = 0; x < ref.width; x += 3) {
      const ri = (ry * ref.width + x) * 4;
      const ai = (ay * app.width + x) * 4;
      const rl = (ref.data[ri] * 299 + ref.data[ri + 1] * 587 + ref.data[ri + 2] * 114) / 1000;
      const al = (app.data[ai] * 299 + app.data[ai + 1] * 587 + app.data[ai + 2] * 114) / 1000;
      total += Math.abs(rl - al);
      n++;
    }
  }
  return n ? total / n : Infinity;
}

console.log(`${screen}.${theme}  (${ref.width}x${ref.height}px, ${DEVICE.scale}x)\n`);
console.log('  band (pt)     best shift   cost at 0   cost at best');
console.log('  ' + '-'.repeat(52));

const shifts = [];
for (let y = 0; y + BAND <= ref.height; y += BAND) {
  let best = 0;
  let bestCost = Infinity;
  for (let shift = -MAX_SHIFT; shift <= MAX_SHIFT; shift++) {
    const c = cost(y, shift);
    if (c < bestCost) {
      bestCost = c;
      best = shift;
    }
  }
  const zero = cost(y, 0);
  const topPt = (y / DEVICE.scale).toFixed(0).padStart(4);
  const botPt = ((y + BAND) / DEVICE.scale).toFixed(0).padStart(4);
  const shiftPt = (best / DEVICE.scale).toFixed(2).padStart(7);
  // A band that is nearly blank aligns equally well at every shift; say so rather than
  // reporting a meaningless best.
  const flat = Math.abs(zero - bestCost) < 0.35;
  console.log(
    `  ${topPt}-${botPt}    ${shiftPt}pt   ${zero.toFixed(2).padStart(8)}   ${bestCost.toFixed(2).padStart(8)}${flat ? '   (flat, ignore)' : ''}`,
  );
  if (!flat) shifts.push({ y: y / DEVICE.scale, shift: best / DEVICE.scale });
}

if (shifts.length >= 2) {
  const first = shifts[0];
  const last = shifts[shifts.length - 1];
  const span = last.y - first.y;
  console.log(
    `\n  Drift from ${first.shift.toFixed(2)}pt at y=${first.y.toFixed(0)} ` +
      `to ${last.shift.toFixed(2)}pt at y=${last.y.toFixed(0)}.`,
  );
  if (span > 0) {
    const rate = (last.shift - first.shift) / span;
    console.log(`  That is ${(rate * 100).toFixed(2)}pt of drift per 100pt of screen.`);
    console.log(
      rate > 0
        ? '  Positive: the app sits LOWER than the reference and the gap grows, so app line boxes are taller.'
        : '  Negative: the app sits HIGHER than the reference, so app line boxes are shorter.',
    );
  }
}
