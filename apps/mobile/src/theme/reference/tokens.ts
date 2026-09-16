/**
 * Design tokens, copied verbatim from the `:root` blocks of `design/reference.html`
 * (SPEC.md 8.2). The reference is the visual source of truth; nothing here is eyeballed
 * or recomputed, and `__tests__/tokens.test.ts` parses the reference and fails if these
 * drift from it.
 *
 * This is the new design system. `src/theme/tokens.ts` is the previous placeholder set
 * that the not-yet-rebuilt screens still read; screens move across as they are ported
 * (SPEC.md M0.5), so the two coexist until the last one moves.
 *
 * 1 CSS px is 1 point (SPEC.md 8.2). Every number here is a point value.
 */

export type BaseColors = {
  /** `--bg`: the page behind the phone. Only reachable in the app as an overscroll. */
  bg: string;
  /** `--scr`: the screen background. */
  scr: string;
  /** `--canvas`: the screen background on the Figma-derived screens (`.scr.fx`). */
  canvas: string;
  /** `--card`: card and tab-bar fill. */
  card: string;
  /** `--surface`: recessed fill, e.g. `.iconbtn`, `.tile`. */
  surface: string;
  ink: string;
  muted: string;
  line: string;
  link: string;
  good: string;
  bad: string;
  warn: string;
};

export const lightBase: BaseColors = {
  bg: '#E7EAEE',
  scr: '#FFFFFF',
  canvas: '#F4F5F7',
  card: '#FFFFFF',
  surface: '#F3F4F6',
  ink: '#101318',
  muted: '#6B7280',
  line: '#E6E8EC',
  link: '#2563EB',
  good: '#1B9E5A',
  bad: '#D63B33',
  warn: '#C98B12',
};

export const darkBase: BaseColors = {
  bg: '#06080B',
  scr: '#0E1115',
  canvas: '#101216',
  card: '#1A1D23',
  surface: '#181C22',
  ink: '#F1F3F6',
  muted: '#9AA3AE',
  line: '#252A31',
  link: '#6EA0FF',
  good: '#3CCB7F',
  bad: '#FF6A60',
  warn: '#F2B84B',
};

/**
 * `--frame` and `--shadow` are deliberately absent. They style the phone bezel and its
 * drop shadow, which SPEC.md 8.1 lists as presentation around the mockup rather than
 * part of the app.
 */

/** Corner radii, from the classes that set them. */
export const radius = {
  /** `.fx-search`, `.fx-seg` */
  sm: 10,
  /** `.fx-rc`, `.fx-row`, `.tile` sits at 16 */
  md: 12,
  /** `.fx-list` */
  lg: 14,
  /** `.tile` */
  tile: 16,
  /** `.hero`, on the earlier-style screens. */
  hero: 24,
  /** `.fx-hero`, on the Figma-derived screens. Not the same as `.hero`. */
  heroFx: 18,
  /** `.scr` inside the bezel; the app has the device's own corners instead */
  screen: 40,
  pill: 999,
} as const;

/** Border widths. The reference uses 1.5 almost everywhere and 1 for hairlines. */
export const border = {
  hairline: 1,
  card: 1.5,
  pill: 1.5,
} as const;

/** Icon sizes. `.ico` is 20, the tab bar overrides it to 23. */
export const iconSize = {
  default: 20,
  tab: 23,
} as const;

/** Screen padding. `.body` is `4px 16px 16px`. */
export const screenPadding = {
  top: 4,
  horizontal: 16,
  bottom: 16,
} as const;

/**
 * Motion, from SPEC.md 8.2 and the reference CSS. Every one of these must be skipped
 * when Reduce Motion is on.
 */
export const motion = {
  /** Side panels: `transform .32s cubic-bezier(.2,.8,.2,1)`. */
  panelMs: 320,
  panelEasing: [0.2, 0.8, 0.2, 1] as const,
  /** `.hero` background transition. */
  heroMs: 250,
  /** The live dot pulse. */
  livePulseMs: 1600,
  /** Relive advances one story step per 1.7s (SPEC.md 6.19). */
  reliveStepMs: 1700,
} as const;
