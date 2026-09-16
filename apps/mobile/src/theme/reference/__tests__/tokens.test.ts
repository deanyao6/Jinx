import { darkBase, lightBase, motion, radius } from '../tokens';

/**
 * SPEC.md 8.2 says to copy token values verbatim from the reference CSS and never to
 * eyeball them. A hand-copied constant satisfies that once, on the day it is written.
 * This test re-reads `design/reference.html` and fails if the two ever disagree, so the
 * rule keeps holding when the reference is revised.
 */
declare const __dirname: string;
declare function require(id: string): unknown;

const { readFileSync } = require('node:fs') as { readFileSync: (p: string, enc: string) => string };
const { join } = require('node:path') as { join: (...parts: string[]) => string };

const html = readFileSync(
  join(__dirname, '..', '..', '..', '..', '..', '..', 'design', 'reference.html'),
  'utf8',
);

/** Pull a `--name:value` declaration out of a specific CSS block. */
function varsIn(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;}]+)/gi)) {
    const key = m[1];
    const value = m[2];
    if (key && value) out[key] = value.trim();
  }
  return out;
}

/** The light block is the first `:root{...}`. */
function lightBlock(): string {
  const m = html.match(/:root\s*\{([^}]*)\}/);
  if (!m?.[1]) throw new Error('could not find the light :root block in the reference');
  return m[1];
}

/** The dark block is `:root[data-theme="dark"]{...}`, which duplicates the media query. */
function darkBlock(): string {
  const m = html.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/);
  if (!m?.[1]) throw new Error('could not find the dark :root block in the reference');
  return m[1];
}

describe('reference design tokens', () => {
  const light = varsIn(lightBlock());
  const dark = varsIn(darkBlock());

  const cases: [keyof typeof lightBase, string][] = [
    ['bg', 'bg'],
    ['scr', 'scr'],
    ['canvas', 'canvas'],
    ['card', 'card'],
    ['surface', 'surface'],
    ['ink', 'ink'],
    ['muted', 'muted'],
    ['line', 'line'],
    ['link', 'link'],
    ['good', 'good'],
    ['bad', 'bad'],
    ['warn', 'warn'],
  ];

  it.each(cases)('light --%s matches the reference', (token, cssVar) => {
    expect(lightBase[token].toLowerCase()).toBe(light[cssVar]?.toLowerCase());
  });

  it.each(cases)('dark --%s matches the reference', (token, cssVar) => {
    expect(darkBase[token].toLowerCase()).toBe(dark[cssVar]?.toLowerCase());
  });

  it('covers every base variable the reference defines', () => {
    // --frame and --shadow style the phone bezel, which SPEC.md 8.1 excludes.
    const presentation = new Set(['frame', 'shadow']);
    const defined = Object.keys(light).filter((k) => !presentation.has(k));
    expect(defined.sort()).toEqual(Object.keys(lightBase).sort());
  });

  it('takes the panel transition from the reference', () => {
    expect(html).toContain('cubic-bezier(.2,.8,.2,1)');
    expect(motion.panelMs).toBe(320);
    expect(motion.panelEasing).toEqual([0.2, 0.8, 0.2, 1]);
  });

  it('takes both hero radii from the reference', () => {
    // The two hero cards do NOT share a radius: `.hero` is 24px and `.fx-hero` is 18px.
    // They are easy to conflate, and conflating them is invisible without a diff.
    expect(html).toMatch(/\.hero\{[^}]*border-radius:24px/);
    expect(radius.hero).toBe(24);
    expect(html).toMatch(/\.fx-hero\{[^}]*border-radius:18px/);
    expect(radius.heroFx).toBe(18);
  });
});
