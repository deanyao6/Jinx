// Proves the harness end to end and measures the top safe-area inset.
//
// Run after `npm run ios`. It asks the app for the self-test screen over the control
// channel, reads the marker back out of the raw screenshot, and finds the first row of
// the self-test fill, which starts exactly at the app's top safe-area inset. That row is
// the value TOP_CROP_PT must hold for this device.

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  bootDevice,
  screenshot,
  launch,
  terminate,
  isInstalled,
  setAppearance,
} from './simctl.mjs';
import { readPng } from './png.mjs';
import { readMarker, hash16 } from './marker.mjs';
import { startControlServer } from './control.mjs';
import { DEVICE, TOP_CROP_PT } from './geometry.mjs';

const BUNDLE_ID = process.env.PARITY_BUNDLE_ID ?? 'com.deanyao.jinx';
const SELFTEST_ID = 'parity-selftest';
const INK = [0, 255, 127];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const control = await startControlServer();
control.set('selftest');

const udid = await bootDevice();
if (!(await isInstalled(udid, BUNDLE_ID))) {
  console.error(`${BUNDLE_ID} is not installed. Run \`npm run ios\` first.`);
  await control.close();
  process.exit(1);
}

await setAppearance(udid, 'light');
await terminate(udid, BUNDLE_ID);
await launch(udid, BUNDLE_ID);

const dir = await mkdtemp(join(tmpdir(), 'jinx-selftest-'));
const file = join(dir, 'selftest.png');
const expected = hash16(SELFTEST_ID);

// Poll until the app has picked the screen up, rather than sleeping a fixed time.
let png = null;
let marker = { present: false };
const deadline = Date.now() + 40_000;
while (Date.now() < deadline) {
  await sleep(700);
  await screenshot(udid, file);
  png = await readPng(file);
  marker = readMarker(png);
  if (marker.present && marker.value === expected) break;
}

let failed = false;

if (!marker.present) {
  console.log('FAIL  marker: not found after 40s. The app never rendered the self-test screen.');
  console.log('      Is Metro running, and did the app reload since ParityHost was added?');
  failed = true;
} else if (marker.value !== expected) {
  console.log(
    `FAIL  marker: read 0x${marker.value.toString(16)}, expected 0x${expected.toString(16)}. ` +
      'hash16 disagrees between the app and the harness.',
  );
  failed = true;
} else {
  console.log(
    `ok    marker: round-tripped 0x${expected.toString(16).padStart(4, '0')} for "${SELFTEST_ID}"`,
  );
}

const isInk = (x, y) => {
  const i = (y * png.width + x) * 4;
  return (
    Math.abs(png.data[i] - INK[0]) <= 8 &&
    Math.abs(png.data[i + 1] - INK[1]) <= 8 &&
    Math.abs(png.data[i + 2] - INK[2]) <= 8
  );
};
let firstInkRow = -1;
if (png) {
  for (let y = 0; y < png.height; y++) {
    if (isInk(Math.floor(png.width / 2), y) && isInk(4, y) && isInk(png.width - 5, y)) {
      firstInkRow = y;
      break;
    }
  }
}
if (firstInkRow < 0) {
  console.log('FAIL  inset: the self-test fill was never found.');
  failed = true;
} else {
  const insetPt = firstInkRow / DEVICE.scale;
  console.log(`ok    inset: app content starts at row ${firstInkRow}px = ${insetPt}pt`);
  if (Math.abs(insetPt - TOP_CROP_PT) > 0.5) {
    console.log(
      `FAIL  geometry: TOP_CROP_PT is ${TOP_CROP_PT} but the measured inset is ${insetPt}. ` +
        `Set PARITY_TOP_CROP=${insetPt}, or update scripts/parity/geometry.mjs.`,
    );
    failed = true;
  } else {
    console.log(`ok    geometry: TOP_CROP_PT ${TOP_CROP_PT} matches the measured inset`);
  }
}

console.log(`\nShot: ${file}`);
await control.close();
process.exit(failed ? 1 : 0);
