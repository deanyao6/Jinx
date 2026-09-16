import { REFERENCE_TEAMS, type TeamTokens } from '../teams';

/**
 * The reference's `.t-*` classes are the authoritative team palettes (SPEC.md 8.2).
 * Rather than trust that 14 palettes were transcribed correctly, this parses them back
 * out of design/reference.html and compares.
 */
declare const __dirname: string;
declare function require(id: string): unknown;

const { readFileSync } = require('node:fs') as { readFileSync: (p: string, enc: string) => string };
const { join } = require('node:path') as { join: (...parts: string[]) => string };

const html = readFileSync(
  join(__dirname, '..', '..', '..', '..', '..', '..', 'design', 'reference.html'),
  'utf8',
);

const expand = (hex: string) =>
  hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase()
    : hex.toLowerCase();

/** Light values: `.t-key{--tf:..;--t:..;--t2:..;--on:..}` at the top level. */
function lightRules(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const m of html.matchAll(/^\.t-([a-z]+)\{([^}]*)\}/gm)) {
    const key = m[1];
    const vars: Record<string, string> = {};
    for (const v of (m[2] ?? '').matchAll(/--([a-z0-9]+):([^;}]+)/gi)) {
      if (v[1] && v[2]) vars[v[1]] = v[2].trim();
    }
    if (key) out[key] = vars;
  }
  return out;
}

/** Dark overrides: `:root[data-theme="dark"] .t-key{...}`. */
function darkRules(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const m of html.matchAll(/:root\[data-theme="dark"\] \.t-([a-z]+)\{([^}]*)\}/g)) {
    const key = m[1];
    const vars: Record<string, string> = {};
    for (const v of (m[2] ?? '').matchAll(/--([a-z0-9]+):([^;}]+)/gi)) {
      if (v[1] && v[2]) vars[v[1]] = v[2].trim();
    }
    if (key) out[key] = vars;
  }
  return out;
}

describe('reference team palettes', () => {
  const light = lightRules();
  const dark = darkRules();
  const keys = Object.keys(REFERENCE_TEAMS) as (keyof typeof REFERENCE_TEAMS)[];

  it('covers exactly the teams the reference defines', () => {
    expect(keys.sort()).toEqual(Object.keys(light).sort());
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it.each(keys)('%s light values match the reference', (key) => {
    const p: TeamTokens = REFERENCE_TEAMS[key];
    const css = light[key];
    expect(expand(p.light.fill)).toBe(expand(css?.tf ?? ''));
    expect(expand(p.light.accent)).toBe(expand(css?.t ?? ''));
    expect(expand(p.light.second)).toBe(expand(css?.t2 ?? ''));
    expect(expand(p.light.onFill)).toBe(expand(css?.on ?? ''));
  });

  it.each(keys)('%s dark values match the reference', (key) => {
    const p: TeamTokens = REFERENCE_TEAMS[key];
    const css = dark[key];
    expect(expand(p.dark.accent)).toBe(expand(css?.t ?? ''));
    expect(expand(p.dark.second)).toBe(expand(css?.t2 ?? ''));
    // Only .t-none restates --on in dark; everything else keeps the light value.
    const expectedOn = css?.on ?? light[key]?.on ?? '';
    expect(expand(p.dark.onFill)).toBe(expand(expectedOn));
  });

  it.each(keys)('%s keeps one fill across both themes', (key) => {
    // SPEC.md 8.2: --tf is the same in both themes. The reference never overrides it.
    expect(REFERENCE_TEAMS[key].dark.fill).toBe(REFERENCE_TEAMS[key].light.fill);
    expect(dark[key]).not.toHaveProperty('tf');
  });
});
