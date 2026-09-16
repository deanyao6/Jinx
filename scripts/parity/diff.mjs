// Diffs app shots against reference shots with pixelmatch and writes, per screen and
// theme, a diff image and a three-panel contact sheet (reference | app | diff). Prints
// a mismatch percentage per pair and a table at the end.
//
// The percentage is the number, but the contact sheet is the evidence. A screen is only
// finished when the sheet looks right; a low percentage on a blank screen is still a
// blank screen.

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { SCREENS, THEMES } from './screens.mjs';
import { OUT_DIR, DEVICE, COMPARE } from './geometry.mjs';
import { readPng, writePng, blank, paste } from './png.mjs';

// pixelmatch's default 0.1 flags sub-pixel antialiasing differences that no native
// renderer can avoid. 0.15 with antialiasing detection on keeps real layout and colour
// differences while ignoring the text rasteriser.
const THRESHOLD = Number(process.env.PARITY_THRESHOLD ?? 0.15);

const GUTTER = 24;
const LABEL_H = 0; // labels live in the printed table, not burned into the PNG

function contactSheet(ref, app, diff) {
  const width = ref.width * 3 + GUTTER * 4;
  const height = ref.height + GUTTER * 2 + LABEL_H;
  const sheet = blank(width, height, [124, 132, 144, 255]);
  paste(sheet, ref, GUTTER, GUTTER);
  paste(sheet, app, GUTTER * 2 + ref.width, GUTTER);
  paste(sheet, diff, GUTTER * 3 + ref.width * 2, GUTTER);
  return sheet;
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  await mkdir(`${OUT_DIR}/diff`, { recursive: true });
  await mkdir(`${OUT_DIR}/sheets`, { recursive: true });

  // Reference shots are only regenerated when asked, so a change to capture-reference.mjs
  // silently leaves old ones in place and every number after it is measured against the
  // wrong image. That happened once here: a fix to strip the slide-over panels' fake
  // status rows was applied to some screens and not others, and the screens still holding
  // an old reference scored nearly twice as high. Nothing about the output said so.
  const captureMtime = (await stat('scripts/parity/capture-reference.mjs')).mtimeMs;
  const stale = [];

  const rows = [];

  for (const screen of SCREENS) {
    if (only.length && !only.includes(screen.id)) continue;
    for (const theme of THEMES) {
      const refPath = `${OUT_DIR}/reference/${screen.id}.${theme}.png`;
      const appPath = `${OUT_DIR}/app/${screen.id}.${theme}.png`;

      if (!existsSync(refPath)) {
        rows.push({ id: screen.id, theme, status: 'no reference shot' });
        continue;
      }
      if (!existsSync(appPath)) {
        rows.push({ id: screen.id, theme, status: 'not built' });
        continue;
      }

      if ((await stat(refPath)).mtimeMs < captureMtime) stale.push(`${screen.id}.${theme}`);

      const ref = await readPng(refPath);
      const app = await readPng(appPath);
      if (ref.width !== app.width || ref.height !== app.height) {
        rows.push({
          id: screen.id,
          theme,
          status: `size ${app.width}x${app.height} vs ref ${ref.width}x${ref.height}`,
        });
        continue;
      }

      const diff = new PNG({ width: ref.width, height: ref.height });
      const differing = pixelmatch(ref.data, app.data, diff.data, ref.width, ref.height, {
        threshold: THRESHOLD,
        includeAA: false,
        alpha: 0.25,
      });
      const pct = (differing / (ref.width * ref.height)) * 100;

      await writePng(`${OUT_DIR}/diff/${screen.id}.${theme}.png`, diff);
      await writePng(`${OUT_DIR}/sheets/${screen.id}.${theme}.png`, contactSheet(ref, app, diff));
      rows.push({ id: screen.id, theme, pct, differing });
    }
  }

  const pad = (s, n) => String(s).padEnd(n);
  const w = Math.max(...rows.map((r) => r.id.length), 8) + 2;
  console.log(`\n${pad('screen', w)}${pad('theme', 8)}mismatch`);
  console.log('-'.repeat(w + 8 + 10));
  for (const r of rows) {
    const value = r.status ?? `${r.pct.toFixed(2)}%`;
    console.log(`${pad(r.id, w)}${pad(r.theme, 8)}${value}`);
  }

  const scored = rows.filter((r) => r.pct !== undefined);
  if (scored.length) {
    const worst = scored.reduce((a, b) => (a.pct > b.pct ? a : b));
    const mean = scored.reduce((a, b) => a + b.pct, 0) / scored.length;
    console.log(
      `\n${scored.length} compared, mean ${mean.toFixed(2)}%, worst ${worst.id}.${worst.theme} at ${worst.pct.toFixed(2)}%`,
    );
  }
  if (stale.length) {
    console.log(
      `\nWARNING: ${stale.length} reference shots are older than capture-reference.mjs, so ` +
        `they were taken with different code.\nRun \`npm run parity:ref\` before trusting these ` +
        `numbers:\n  ${stale.slice(0, 8).join(', ')}${stale.length > 8 ? ', ...' : ''}`,
    );
  }

  const unbuilt = rows.filter((r) => r.status === 'not built').length;
  if (unbuilt) console.log(`${unbuilt} screens not built in the app yet.`);
  console.log(`\nContact sheets: ${OUT_DIR}/sheets/  (reference | app | diff)`);

  await writeFile(
    `${OUT_DIR}/summary.json`,
    JSON.stringify(
      {
        device: DEVICE,
        compare: COMPARE,
        threshold: THRESHOLD,
        generatedAt: new Date().toISOString(),
        rows,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
