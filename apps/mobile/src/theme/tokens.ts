/**
 * Theme tokens for the screens that have not been rebuilt against `design/reference.html`
 * yet (SPEC.md M0.5). 46 of them still read from here; the 13 rebuilt ones read
 * `theme/reference/tokens.ts` directly.
 *
 * These used to be the placeholder palette from `docs/turnstile-ui.html`, which is why the
 * sub screens looked like a different app: navy ink on a grey page, next to the reference's
 * near-black on white. Every colour below is now DERIVED from the reference's own base
 * colours rather than eyeballed, so a screen inherits the real design system's palette
 * without being rewritten. That is a palette fix, not a port: layout, spacing and component
 * shapes still differ, and each screen still has to move across properly.
 *
 * The mapping is one-to-one where the reference has an equivalent, and stated where it does
 * not. `bg`/`scr`/`card`/`surface`/`ink`/`muted`/`line` carry over exactly.
 */
import {
  darkBase,
  lightBase,
  radius as referenceRadius,
  type BaseColors,
} from './reference/tokens';

export type ColorTokens = {
  page: string;
  screen: string;
  card: string;
  ink: string;
  muted: string;
  line: string;
  red: string;
  blue: string;
  green: string;
  gold: string;
  tint: string;
  onInk: string;
};

/** The reference's own names, for the mapping below. */
function fromBase(b: BaseColors): ColorTokens {
  return {
    page: b.bg,
    screen: b.scr,
    card: b.card,
    ink: b.ink,
    muted: b.muted,
    line: b.line,
    red: b.bad,
    blue: b.link,
    green: b.good,
    gold: b.warn,
    // `tint` is this system's "slightly recessed fill", which is what `surface` is.
    tint: b.surface,
    // `onInk` is text drawn ON an ink-filled surface, so it is the screen colour.
    onInk: b.scr,
  };
}

export const lightColors: ColorTokens = fromBase(lightBase);
export const darkColors: ColorTokens = fromBase(darkBase);

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 } as const;

/** The reference's radii, plus the `lg` these screens use for their larger cards. */
export const radius = {
  sm: referenceRadius.sm,
  md: referenceRadius.md,
  lg: referenceRadius.tile,
  pill: referenceRadius.pill,
} as const;

export const type = {
  display: { fontSize: 64, fontWeight: '900', lineHeight: 60, letterSpacing: -1 },
  h1: { fontSize: 30, fontWeight: '800', lineHeight: 32 },
  h2: { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  stat: { fontSize: 26, fontWeight: '800', lineHeight: 28 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  sub: { fontSize: 13.5, fontWeight: '400', lineHeight: 19 },
  caption: { fontSize: 12.5, fontWeight: '400', lineHeight: 17 },
  label: { fontSize: 11.5, fontWeight: '600', lineHeight: 14 },
} as const;

export type Theme = {
  scheme: 'light' | 'dark';
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof type;
};

export function makeTheme(scheme: 'light' | 'dark'): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    spacing,
    radius,
    type,
  };
}
