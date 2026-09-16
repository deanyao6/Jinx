// Screenshots the app in the iOS Simulator, one PNG per screen and theme, cropped to the
// same region as the reference shots.
//
// The app is driven over the loopback control channel (control.mjs), not by deep links:
// iOS 26 puts a confirmation dialog in front of every custom-scheme open and simctl
// cannot dismiss it.
//
// A screen is only captured once the app proves it rendered that screen, by painting the
// marker from marker.mjs into the band this script crops away. Without that proof the
// script would screenshot whatever happened to be on screen and the diff would score the
// wrong thing. It did exactly that on its first run: 32 shots of the sign-in screen,
// each scored against a different reference. Screens still to be built produce no app
// shot at all and are reported as not built.

import { createHash } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { SCREENS, THEMES } from './screens.mjs';
import { DEVICE, PX, COMPARE, OUT_DIR, TOP_CROP_PT } from './geometry.mjs';
import {
  bootDevice,
  setAppearance,
  screenshot,
  terminate,
  launch,
  isInstalled,
} from './simctl.mjs';
import { readPng, writePng, crop } from './png.mjs';
import { readMarker, hash16 } from './marker.mjs';
import { startControlServer } from './control.mjs';

const BUNDLE_ID = process.env.PARITY_BUNDLE_ID ?? 'com.deanyao.jinx';

// How long to wait for the app to pick a screen up off the control channel. It polls
// every 150ms, so this is generous; it only ever elapses when a screen is not built.
const ROUTE_TIMEOUT_MS = Number(process.env.PARITY_ROUTE_TIMEOUT_MS ?? 6000);
// Settle time after the marker appears, for animations and image decoding.
const SETTLE_MS = Number(process.env.PARITY_SETTLE_MS ?? 450);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Which control-channel path and params produce a given screen id.
 *
 * The catalogue still writes routes as `jinx://parity/<path>?<params>` because that is
 * the clearest way to say what the app should show, even though the harness now delivers
 * it over the control channel rather than as a deep link.
 */
function routeFor(screen) {
  if (!screen.route) return null;
  const url = new URL(screen.route);
  return {
    path: url.pathname.replace(/^\//, '').replace(/\/$/, ''),
    params: Object.fromEntries(url.searchParams),
  };
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const outDir = `${OUT_DIR}/app`;
  const tmpDir = `${OUT_DIR}/.tmp`;
  await mkdir(outDir, { recursive: true });
  await mkdir(tmpDir, { recursive: true });

  const udid = await bootDevice();
  if (!(await isInstalled(udid, BUNDLE_ID))) {
    console.error(
      `${BUNDLE_ID} is not installed on ${DEVICE.name}.\nRun \`npm run ios\` first; see docs/simulator.md.`,
    );
    process.exitCode = 1;
    return;
  }

  const control = await startControlServer();
  const captured = [];
  const missing = [];
  const seen = new Map();

  try {
    for (const theme of THEMES) {
      await setAppearance(udid, theme);
      // Relaunch so the app re-reads the appearance from a cold start rather than
      // relying on a live observer that may not exist yet.
      await terminate(udid, BUNDLE_ID);
      await launch(udid, BUNDLE_ID);

      for (const screen of SCREENS) {
        if (only.length && !only.includes(screen.id)) continue;
        const route = routeFor(screen);
        if (!route) {
          missing.push(`${screen.id}.${theme} (no route in screens.mjs)`);
          continue;
        }

        control.set(route.path, route.params);

        const expected = hash16(screen.id);
        const raw = join(tmpDir, `${screen.id}.${theme}.raw.png`);
        const deadline = Date.now() + ROUTE_TIMEOUT_MS;
        let png = null;
        let ok = false;
        let sawOther = null;

        while (Date.now() < deadline) {
          await sleep(300);
          await screenshot(udid, raw);
          png = await readPng(raw);
          const marker = readMarker(png);
          if (marker.present && marker.value === expected) {
            ok = true;
            break;
          }
          if (marker.present) sawOther = marker.value;
        }

        if (!ok) {
          missing.push(
            sawOther === null
              ? `${screen.id}.${theme} (no parity marker: screen not built)`
              : `${screen.id}.${theme} (marker 0x${sawOther.toString(16).padStart(4, '0')}, ` +
                  `expected 0x${expected.toString(16).padStart(4, '0')}: the app rendered a different screen)`,
          );
          continue;
        }

        // Take the real shot after a settle, so the marker check does not race a
        // screen that is still laying out.
        await sleep(SETTLE_MS);
        await screenshot(udid, raw);
        png = await readPng(raw);

        if (png.width !== DEVICE.width * DEVICE.scale) {
          console.error(
            `${screen.id}.${theme}: screenshot is ${png.width}px wide, expected ` +
              `${DEVICE.width * DEVICE.scale}px. Wrong simulator?`,
          );
          process.exitCode = 1;
          return;
        }

        const cropped = crop(png, { y: PX.topCrop, width: PX.width, height: PX.height });
        const file = `${outDir}/${screen.id}.${theme}.png`;
        await writePng(file, cropped);
        captured.push(file);
        seen.set(`${screen.id}.${theme}`, createHash('sha1').update(cropped.data).digest('hex'));
        process.stdout.write(`  ${screen.id}.${theme}\n`);
      }
    }
  } finally {
    await control.close();
    await rm(tmpDir, { recursive: true, force: true });
  }

  console.log(`\n${captured.length} app shots in ${outDir}/`);
  console.log(
    `Cropped ${TOP_CROP_PT}pt off the top; compared region ${COMPARE.width}x${COMPARE.height}pt.`,
  );
  if (missing.length) {
    console.log(`\n${missing.length} screens not captured:`);
    for (const m of missing) console.log(`  ${m}`);
  }

  // Backstop the marker cannot provide: distinct screens that render the same pixels.
  const byHash = new Map();
  for (const [key, h] of seen) {
    if (!byHash.has(h)) byHash.set(h, []);
    byHash.get(h).push(key);
  }
  for (const [, keys] of byHash) {
    if (keys.length > 2) {
      console.log(
        `\nWARNING: ${keys.length} app shots are pixel-identical, so those routes are ` +
          `probably not rendering distinct screens:\n  ${keys.join(', ')}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
