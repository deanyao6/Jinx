// Finds the real top inset of the app on this simulator, so geometry.mjs holds a
// measured number instead of a guessed one.
//
// What this measures, and what it does not. Scanning down from the top, it reports the
// last row that is not a single flat colour. That is the bottom of the drawn status bar
// band: the clock, the Dynamic Island and the battery. It is NOT the safe-area top
// inset, which sits lower because iOS leaves a gap below the island before app content
// starts. The safe-area inset is the number the crop needs, and it is the larger of the
// two, so treat this output as a floor and a sanity check on the device geometry rather
// than as the answer.
//
// The authoritative confirmation is visual: once a screen is ported, run the harness and
// look at the side-by-side. If TOP_CROP_PT is wrong the two halves are offset vertically
// by a constant, which is obvious in the contact sheet and invisible in a percentage.

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootDevice, screenshot } from './simctl.mjs';
import { readPng } from './png.mjs';
import { DEVICE } from './geometry.mjs';

const dir = await mkdtemp(join(tmpdir(), 'jinx-inset-'));
const udid = await bootDevice();
const file = join(dir, 'shot.png');
await screenshot(udid, file);
const png = await readPng(file);

console.log(`Screenshot: ${png.width}x${png.height}px`);
console.log(`Device:     ${DEVICE.name} ${DEVICE.width}x${DEVICE.height}pt @${DEVICE.scale}x`);
if (png.width !== DEVICE.width * DEVICE.scale) {
  console.log(
    `\nMISMATCH: the screenshot is ${png.width / DEVICE.scale}pt wide but geometry.mjs ` +
      `says ${DEVICE.width}pt. Set PARITY_WIDTH/PARITY_HEIGHT, or pick another device.`,
  );
}

// Report the first row from the top whose pixels are all identical to each other,
// i.e. a uniform row, after a run of non-uniform rows. That is where the status bar
// glyphs stop.
function rowIsUniform(y) {
  const base = y * png.width * 4;
  const [r, g, b] = [png.data[base], png.data[base + 1], png.data[base + 2]];
  for (let x = 1; x < png.width; x++) {
    const i = base + x * 4;
    if (png.data[i] !== r || png.data[i + 1] !== g || png.data[i + 2] !== b) return false;
  }
  return true;
}

let lastGlyphRow = 0;
for (let y = 0; y < Math.min(png.height, 120 * DEVICE.scale); y++) {
  if (!rowIsUniform(y)) lastGlyphRow = y;
}
const insetPt = Math.ceil((lastGlyphRow + 1) / DEVICE.scale);
console.log(
  `\nStatus bar band ends at row ${lastGlyphRow}px, so the safe-area inset is > ${insetPt}pt.`,
);
console.log(`geometry.mjs uses TOP_CROP_PT = ${process.env.PARITY_TOP_CROP ?? 62}, the documented`);
console.log('safe-area top inset for this device family. Confirm it against a contact sheet.');
console.log(`\nShot kept at ${file} so the number can be checked by eye.`);
