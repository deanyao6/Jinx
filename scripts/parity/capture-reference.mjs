// Screenshots design/reference.html, one PNG per screen and theme.
//
// The reference is the visual source of truth and is never edited; every change here
// is made to a live copy in the browser. The phone frame, the fake status row, the
// page header and the captions are presentation, not app (SPEC.md 8.1), so they are
// removed before the shot.

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCREENS, THEMES } from './screens.mjs';
import { DEVICE, COMPARE, OUT_DIR } from './geometry.mjs';

const REFERENCE = resolve('design/reference.html');

// Installed before any page script runs, so the reference's own timers are captured.
// Without this the Pick a side countdown and the Relive player make every shot differ
// from the last, and a mismatch percentage would measure the clock, not the layout.
const FREEZE_CLOCK = () => {
  const pending = [];
  let now = 0;
  const realSetInterval = window.setInterval.bind(window);
  const realSetTimeout = window.setTimeout.bind(window);
  window.setInterval = (fn, ms) => {
    const h = { fn, ms, next: ms, repeat: true };
    pending.push(h);
    return h;
  };
  window.setTimeout = (fn, ms) => {
    const h = { fn, ms, next: ms, repeat: false };
    pending.push(h);
    return h;
  };
  window.clearInterval = (h) => {
    const i = pending.indexOf(h);
    if (i >= 0) pending.splice(i, 1);
  };
  window.clearTimeout = window.clearInterval;
  // Advance the fake clock by `ms`, firing whatever the reference scheduled.
  window.__parityTick = (ms) => {
    const target = now + ms;
    for (let guard = 0; guard < 10000; guard++) {
      const due = pending.filter((h) => h.next <= target).sort((a, b) => a.next - b.next)[0];
      if (!due) break;
      now = due.next;
      if (due.repeat) due.next += due.ms;
      else pending.splice(pending.indexOf(due), 1);
      due.fn();
    }
    now = target;
  };
  window.__parityRealSetTimeout = realSetTimeout;
  window.__parityRealSetInterval = realSetInterval;
};

// Motion is frozen rather than removed: a shot taken mid-transition is not reproducible,
// and SPEC.md 8.2 requires Reduce Motion support anyway, so the still frame is a state
// the app must also be able to render.
const FREEZE_MOTION = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
  /* Scroll bars are chrome, not design. */
  ::-webkit-scrollbar { display: none !important; }
`;

/**
 * Strip the page down to one phone's screen, sized to the device.
 * Runs in the browser. Returns the selector of the element to shoot.
 */
function isolate(nth, width, height) {
  const phones = Array.from(document.querySelectorAll('.phone'));
  const phone = phones[nth];
  if (!phone) throw new Error(`No phone frame at index ${nth}`);
  const scr = phone.querySelector('.scr');

  // Hide the page around it. The SVG sprite must stay in the document because the
  // icons reference it with <use href="#...">, so this hides siblings rather than
  // removing them.
  document.querySelectorAll('.intro, .rail > .shot figcaption, .theme').forEach((el) => {
    el.style.display = 'none';
  });
  Array.from(document.querySelectorAll('.rail > .shot')).forEach((shot) => {
    if (!shot.contains(phone)) shot.style.display = 'none';
  });

  // The fake status row is presentation only; the app uses the real one.
  const status = scr.querySelector('.status');
  if (status) status.remove();

  // Unwrap the frame: no bezel, no padding, no corner radius, at the device size.
  // The screen keeps every other CSS rule, so the layout reflows the way the CSS
  // says it should at a wider viewport instead of being scaled up.
  phone.style.cssText = `width:${width}px;height:${height}px;background:none;border-radius:0;padding:0;box-shadow:none;margin:0`;
  scr.style.cssText += `;width:${width}px;height:${height}px;border-radius:0`;

  document.body.style.cssText = 'margin:0;padding:0;background:var(--scr)';
  const rail = document.querySelector('.rail');
  if (rail) rail.style.cssText = 'display:block;padding:0;margin:0;overflow:visible';
  const shot = phone.closest('.shot');
  if (shot) shot.style.cssText = 'width:auto;margin:0';

  return true;
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  await mkdir(`${OUT_DIR}/reference`, { recursive: true });

  const browser = await chromium.launch();
  const written = [];

  for (const theme of THEMES) {
    for (const screen of SCREENS) {
      if (only.length && !only.includes(screen.id)) continue;

      const context = await browser.newContext({
        viewport: { width: DEVICE.width, height: DEVICE.height },
        deviceScaleFactor: DEVICE.scale,
        colorScheme: theme,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      await page.addInitScript(FREEZE_CLOCK);
      await page.goto(pathToFileURL(REFERENCE).href, { waitUntil: 'load' });
      await page.addStyleTag({ content: FREEZE_MOTION });

      // The reference's own toggle sets data-theme; setting it directly is the same
      // code path and avoids depending on the toggle, which is not part of the app.
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);

      // Archivo is a webfont. Without this the first shots render in the fallback
      // and every metric is wrong.
      await page.waitForFunction(() => document.fonts.status === 'loaded');

      await page.evaluate(
        ({ nth, w, h, src }) => {
          // `isolate` is defined in Node, so it crosses into the page as source.
          const fn = new Function(`return (${src})`)();
          return fn(nth, w, h);
        },
        { nth: screen.nth, w: COMPARE.width, h: COMPARE.height, src: isolate.toString() },
      );

      if (screen.prepare) await screen.prepare(page);
      const frame = page.locator('.phone:visible .scr');
      await page.waitForFunction(() => document.fonts.status === 'loaded');

      const file = `${OUT_DIR}/reference/${screen.id}.${theme}.png`;
      const buf = await frame.screenshot({ type: 'png' });
      await writeFile(file, buf);
      written.push(file);
      process.stdout.write(`  ${screen.id}.${theme}\n`);
      await context.close();
    }
  }

  await browser.close();
  console.log(`\n${written.length} reference shots in ${OUT_DIR}/reference/`);
  console.log(`Compared region: ${COMPARE.width}x${COMPARE.height}pt at ${DEVICE.scale}x`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
