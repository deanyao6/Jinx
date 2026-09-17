import { SEAL_SLATE } from '@/components/reference/palettes';
import {
  contrast,
  ENGRAVING_CONTRAST,
  HIGHLIGHT_CONTRAST,
  mix,
  RING_CONTRAST,
  sealColors,
  tintColors,
  visibleOnPage,
} from '@/components/reference/sealColors';
import { wearMarks } from '@/components/reference/sealWear';
import { darkBase, lightBase } from '@/theme/reference/tokens';
import { REFERENCE_TEAMS } from '@/theme/reference/teams';

// Same shape as icons.test.tsx: the mobile tsconfig carries no node types.
declare const __dirname: string;
declare function require(id: string): unknown;
const { readFileSync } = require('node:fs') as { readFileSync: (p: string, enc: string) => string };
const { join } = require('node:path') as { join: (...parts: string[]) => string };

type SeedRow = {
  abbr: string;
  provider: string;
  fill_hex: string;
  on_fill_hex: string;
  secondary_light_hex: string;
  secondary_dark_hex: string;
};

const seeded = (
  JSON.parse(
    readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', '..', 'seed', 'team_colors.json'),
      'utf8',
    ),
  ) as { teams: SeedRow[] }
).teams;

const PAGES = {
  light: { ink: lightBase.ink, surfaces: [lightBase.card, lightBase.canvas] },
  dark: { ink: darkBase.ink, surfaces: [darkBase.card, darkBase.canvas] },
} as const;

describe('sealColors', () => {
  it('returns brass and silver exactly as the reference has them, with the ring left to the ink', () => {
    expect(sealColors('silver')).toEqual({
      highlight: '#EEF0F2',
      base: '#C5CAD0',
      engraving: '#4A5260',
      rim: '#4A5260',
      detail: '#4A5260',
      ring: null,
    });
    expect(sealColors('brass', '#101318').ring).toBeNull();
    expect(sealColors('brass').base).toBe('#D9C79C');
  });

  it('gives gold its own ring and a legible engraving', () => {
    const gold = sealColors('gold');
    expect(gold.ring).not.toBeNull();
    expect(contrast(gold.engraving, gold.base)).toBeGreaterThanOrEqual(ENGRAVING_CONTRAST);
    expect(contrast(gold.engraving, gold.highlight)).toBeGreaterThanOrEqual(ENGRAVING_CONTRAST);
  });

  it('mixes two colours', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#FD5A1E', '#000000', 0)).toBe('#FD5A1E');
    expect(mix('not-a-hex', '#000000', 0.5)).toBe('not-a-hex');
  });

  // The teams Dean named: two reds and blues that are easy, three near-black fills that are
  // lost on a dark screen (chi, lv, sd), a dark green with a gold second (gb), and the one
  // fill too bright for its own white text (sf).
  describe.each(['phi', 'phl', 'sf', 'lad', 'nym', 'chi', 'lv', 'gb', 'sd'] as const)(
    '%s',
    (key) => {
      it.each(['light', 'dark'] as const)('is legible in %s', (scheme) => {
        const p = REFERENCE_TEAMS[key][scheme];
        const page = PAGES[scheme];
        const c = tintColors({ fill: p.fill, second: p.second, onFill: p.onFill }, page.ink);
        expect(contrast(c.engraving, c.base)).toBeGreaterThanOrEqual(ENGRAVING_CONTRAST);
        expect(contrast(c.engraving, c.highlight)).toBeGreaterThanOrEqual(HIGHLIGHT_CONTRAST);
        for (const surface of page.surfaces) {
          expect(contrast(c.ring as string, surface)).toBeGreaterThanOrEqual(RING_CONTRAST);
          // The disc has to be findable on the page: by its own colour, or by its rim.
          expect(
            Math.max(contrast(c.base, surface), contrast(c.rim, surface)),
          ).toBeGreaterThanOrEqual(3);
        }
      });
    },
  );

  it('keeps a dark fill as it is and lifts only the highlight', () => {
    const lv = REFERENCE_TEAMS.lv.dark;
    const c = tintColors(lv);
    expect(c.base).toBe('#1A1A1A');
    expect(c.highlight).toBe('#5F5F5F');
    expect(c.engraving).toBe('#FFFFFF');
    expect(c.rim).toBe(lv.second);
  });

  it('deepens a fill too bright for its own text, and leaves the true colour as the highlight', () => {
    const sf = REFERENCE_TEAMS.sf.light;
    const c = tintColors(sf);
    expect(contrast('#FFFFFF', sf.fill)).toBeLessThan(ENGRAVING_CONTRAST);
    expect(c.base).not.toBe(sf.fill);
    expect(c.highlight).toBe(sf.fill);
  });

  it('turns a gold second into something a white card does not swallow', () => {
    const gb = REFERENCE_TEAMS.gb.light;
    expect(contrast(gb.second, '#FFFFFF')).toBeLessThan(2);
    const ring = visibleOnPage(gb.second, lightBase.ink);
    expect(contrast(ring, '#FFFFFF')).toBeGreaterThanOrEqual(RING_CONTRAST);
    // A colour that already shows is not touched.
    expect(visibleOnPage(REFERENCE_TEAMS.phi.light.second, lightBase.ink)).toBe(
      REFERENCE_TEAMS.phi.light.second,
    );
  });

  it('holds for every one of the 65 seeded palettes, and for slate, in both appearances', () => {
    expect(seeded.length).toBe(65);
    const tints = [
      ...seeded.map((row) => ({
        name: `${row.provider} ${row.abbr}`,
        fill: row.fill_hex,
        onFill: row.on_fill_hex,
        second: { light: row.secondary_light_hex, dark: row.secondary_dark_hex },
      })),
      { name: 'slate', ...SEAL_SLATE },
    ];
    const failures: string[] = [];
    for (const t of tints) {
      for (const scheme of ['light', 'dark'] as const) {
        const page = PAGES[scheme];
        const c = tintColors(
          { fill: t.fill, onFill: t.onFill, second: t.second[scheme] },
          page.ink,
        );
        const ok =
          contrast(c.engraving, c.base) >= ENGRAVING_CONTRAST &&
          contrast(c.engraving, c.highlight) >= HIGHLIGHT_CONTRAST &&
          page.surfaces.every(
            (surface) => Math.max(contrast(c.base, surface), contrast(c.rim, surface)) >= 3,
          );
        if (!ok) failures.push(`${t.name} ${scheme}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('wearMarks', () => {
  it('leaves a crisp seal alone', () => {
    expect(wearMarks('venue-1', 0)).toEqual({
      specks: [],
      blots: [],
      ghost: null,
      swell: 0,
      textBleed: 0,
    });
  });

  it('is the same every time for the same stadium, and different for another', () => {
    expect(wearMarks('venue-1', 2)).toEqual(wearMarks('venue-1', 2));
    expect(wearMarks('venue-1', 1)).toEqual(wearMarks('venue-1', 1));
    expect(wearMarks('venue-1', 2)).not.toEqual(wearMarks('venue-2', 2));
  });

  it('wears heavily more than lightly', () => {
    const light = wearMarks('venue-1', 1);
    const heavy = wearMarks('venue-1', 2);
    expect(light.specks.length).toBeGreaterThan(0);
    expect(heavy.specks.length).toBeGreaterThan(light.specks.length);
    expect(light.blots).toEqual([]);
    expect(heavy.blots.length).toBeGreaterThan(0);
    expect(heavy.swell).toBeGreaterThan(light.swell);
    expect(heavy.textBleed).toBeGreaterThan(0);
    expect(Math.abs(heavy.ghost?.rotate ?? 0)).toBeGreaterThanOrEqual(3.5);
    expect(heavy.ghost?.opacity ?? 0).toBeGreaterThan(light.ghost?.opacity ?? 0);
  });

  it('keeps every speck on the disc', () => {
    for (const seed of ['a', 'b', 'c', '70c73ea3-3458-48b2-ac84-3d6a9b44765e']) {
      for (const s of wearMarks(seed, 2).specks) {
        expect(Math.hypot(s.cx - 50, s.cy - 50) + s.r).toBeLessThan(40);
      }
    }
  });
});
