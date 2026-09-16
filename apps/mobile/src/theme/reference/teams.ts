/**
 * Team palettes, copied verbatim from the `.t-*` classes in `design/reference.html`
 * (SPEC.md 8.2). `__tests__/teams.test.ts` re-reads the reference and fails on drift.
 *
 * These 14 are the ones the reference defines, and they are authoritative. Every other
 * MLB and NFL team is hand-tuned in the same style and stored in the `team_colors`
 * table, which the app reads at runtime; these are the demo-mode and fallback values.
 *
 * The four roles, from SPEC.md 8.2:
 *   fill    `--tf`  badge, button, pill and thumbnail fill, and the hero glow.
 *                   The same value in both themes.
 *   onFill  `--on`  text drawn on top of `fill`. Also the same in both themes.
 *   accent  `--t`   text and small marks. Separate, hand-tuned dark value.
 *   second  `--t2`  rings and borders. Separate dark value.
 */

export type TeamPalette = {
  fill: string;
  onFill: string;
  accent: string;
  second: string;
};

export type TeamTokens = {
  light: TeamPalette;
  dark: TeamPalette;
};

/**
 * `.t-none` is the neutral theme: ink as the accent, used for All teams and every
 * neutral context (SPEC.md 8.2). It is the only palette whose `--on` differs by theme,
 * because its fill is the ink colour itself.
 */
export const NEUTRAL_TEAM_KEY = 'none';

function palette(
  fill: string,
  onFill: string,
  lightAccent: string,
  lightSecond: string,
  darkAccent: string,
  darkSecond: string,
  darkOnFill = onFill,
): TeamTokens {
  return {
    light: { fill, onFill, accent: lightAccent, second: lightSecond },
    dark: { fill, onFill: darkOnFill, accent: darkAccent, second: darkSecond },
  };
}

export const REFERENCE_TEAMS = {
  none: palette('#101318', '#FFFFFF', '#101318', '#6B7280', '#F1F3F6', '#9AA3AE', '#0E1115'),
  phi: palette('#E81828', '#FFFFFF', '#E81828', '#002D72', '#FF3B49', '#7F9DE8'),
  phl: palette('#004C54', '#FFFFFF', '#004C54', '#A5ACAF', '#1E9AA3', '#C9CED1'),
  chi: palette('#0B162A', '#FFFFFF', '#0B162A', '#C83803', '#E8692F', '#8DA2CC'),
  gb: palette('#203731', '#FFFFFF', '#203731', '#FFB612', '#3E9B72', '#FFC43D'),
  lar: palette('#003594', '#FFFFFF', '#003594', '#FFA300', '#5A8AF2', '#FFB43D'),
  lad: palette('#005A9C', '#FFFFFF', '#005A9C', '#EF3E42', '#4FA0E6', '#FF6B6E'),
  sf: palette('#FD5A1E', '#FFFFFF', '#FD5A1E', '#27251F', '#FF7440', '#BDB6A8'),
  chc: palette('#0E3386', '#FFFFFF', '#0E3386', '#CC3433', '#6F90EE', '#FF6664'),
  nym: palette('#002D72', '#FFFFFF', '#002D72', '#FF5910', '#6F90EE', '#FF7A3D'),
  sd: palette('#2F241D', '#FFFFFF', '#2F241D', '#FFC425', '#D6B98C', '#FFC425'),
  nyg: palette('#0B2265', '#FFFFFF', '#0B2265', '#A71930', '#6F8FE8', '#E0485F'),
  bos: palette('#0C2340', '#FFFFFF', '#BD3039', '#0C2340', '#FF5A63', '#7F9DE8'),
  lv: palette('#1A1A1A', '#FFFFFF', '#1A1A1A', '#A5ACAF', '#C9CED1', '#A5ACAF'),
} as const satisfies Record<string, TeamTokens>;

export type ReferenceTeamKey = keyof typeof REFERENCE_TEAMS;

export function referenceTeam(key: string): TeamTokens {
  return REFERENCE_TEAMS[key as ReferenceTeamKey] ?? REFERENCE_TEAMS.none;
}
