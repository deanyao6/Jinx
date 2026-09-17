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
 * not. `bg`/`card`/`surface`/`ink`/`muted`/`line` carry over exactly; `screen` is `canvas`.
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
    // The reference's Figma-derived screens sit on `canvas`, a shade off the card colour, which is
    // what lets a card read as a card with no outline around it.
    screen: b.canvas,
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

/**
 * The type scale. `width` is Archivo's width axis: 100 is the ordinary face, and the 60s are the
 * condensed heavy cut the Passport sets its record and its section headings in. Headings and
 * numbers use it here too, which is most of what makes a sub screen read as the same app.
 */
export const type = {
  display: { fontSize: 64, fontWeight: '900', lineHeight: 60, letterSpacing: -0.6, width: 62 },
  h1: {
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 34,
    letterSpacing: 0.2,
    width: 62,
    upper: true,
  },
  h2: { fontSize: 22, fontWeight: '800', weight: 850, lineHeight: 25, width: 70 },
  /** A section heading, the Passport's "STADIUM STAMPS". */
  section: {
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 20,
    letterSpacing: 0.17,
    width: 62,
    upper: true,
  },
  stat: { fontSize: 30, fontWeight: '900', lineHeight: 30, width: 62 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  sub: { fontSize: 13.5, fontWeight: '400', lineHeight: 19 },
  caption: { fontSize: 12.5, fontWeight: '400', lineHeight: 17 },
  label: { fontSize: 11.5, fontWeight: '600', lineHeight: 14 },
  /** The small caps line above a heading or a value: "LIFETIME RECORD". */
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    weight: 750,
    lineHeight: 14,
    letterSpacing: 0.9,
    upper: true,
  },
} as const;

/**
 * The colour a screen leans on. It is the team in scope (theme/reference/TeamTheme.tsx): the
 * person's own team on their screens, the game's side on a game. With no team it is ink, which
 * is what these screens used for everything before.
 */
export type Accent = {
  /** Solid fill for the one thing to press, a selected chip, a progress bar. */
  fill: string;
  /** Text and icons on top of `fill`. */
  onFill: string;
  /** Team colour as text or a small mark, tuned per appearance to stay readable. */
  text: string;
  /** The team's second colour: rings, a thin rule, the far end of a gradient. */
  second: string;
  /** `fill` washed out, for the background of a card or an icon tile. */
  wash: string;
  /** Whether a team is in scope at all. */
  themed: boolean;
};

export type Theme = {
  scheme: 'light' | 'dark';
  colors: ColorTokens;
  accent: Accent;
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof type;
};

export function neutralAccent(colors: ColorTokens): Accent {
  return {
    fill: colors.ink,
    onFill: colors.onInk,
    text: colors.ink,
    second: colors.muted,
    wash: colors.tint,
    themed: false,
  };
}

export function makeTheme(scheme: 'light' | 'dark', accent?: Accent): Theme {
  const colors = scheme === 'dark' ? darkColors : lightColors;
  return {
    scheme,
    colors,
    accent: accent ?? neutralAccent(colors),
    spacing,
    radius,
    type,
  };
}
