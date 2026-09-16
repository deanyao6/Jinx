/**
 * Theme tokens. Colors, type, and spacing are placeholders per SPEC.md Section 8 and will change;
 * every screen must read from these tokens so restyling stays cheap.
 * Values mirror docs/turnstile-ui.html.
 */
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

export const lightColors: ColorTokens = {
  page: '#DCE2E8',
  screen: '#F6F7F9',
  card: '#FFFFFF',
  ink: '#14213D',
  muted: '#5B6577',
  line: '#D3D8E0',
  red: '#C8102E',
  blue: '#1F5FA8',
  green: '#2E7D4F',
  gold: '#A8740C',
  tint: '#EAF0F7',
  onInk: '#F6F7F9',
};

export const darkColors: ColorTokens = {
  page: '#0D131B',
  screen: '#141B25',
  card: '#1C2532',
  ink: '#E8ECF2',
  muted: '#98A2B3',
  line: '#2A3445',
  red: '#F0506A',
  blue: '#6FA6E8',
  green: '#5FBF86',
  gold: '#E0AE4A',
  tint: '#1F2A3A',
  onInk: '#141B25',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 } as const;

export const radius = { sm: 9, md: 12, lg: 18, pill: 999 } as const;

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
