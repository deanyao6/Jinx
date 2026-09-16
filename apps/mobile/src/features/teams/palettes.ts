import type { TeamTokens } from '@/theme/reference/teams';

/**
 * Team palettes loaded from the `team_colors` table (SPEC.md 5.1, 8.2).
 *
 * `theme/reference/teams.ts` holds only the 14 palettes the reference itself defines, as
 * the demo-mode and offline fallback. This is the full set: 65 rows covering every MLB and
 * NFL team, including the relocated franchises. Without it every team outside those 14
 * falls back to the neutral theme, which is grey.
 *
 * This module is deliberately free of any Supabase or storage import, so the theme layer
 * and its tests can map a row without dragging the network stack in with them. The query
 * itself lives in `queries.ts` alongside the other team queries.
 */

export type TeamColorsRow = {
  team_id: string;
  fill_hex: string;
  on_fill_hex: string;
  primary_light_hex: string;
  secondary_light_hex: string;
  primary_dark_hex: string;
  secondary_dark_hex: string;
};

export const TEAM_COLOR_COLUMNS =
  'team_id, fill_hex, on_fill_hex, primary_light_hex, secondary_light_hex, primary_dark_hex, secondary_dark_hex';

/**
 * Map one row onto the four roles the components read.
 *
 * `fill_hex` and `on_fill_hex` are shared across themes by design — the fill is the same
 * colour in light and dark, and the text on it follows the fill, not the theme. Only the
 * accent and secondary have separate dark values, and they are stored rather than derived
 * because the reference's dark variants are hand-tuned.
 */
export function toTeamTokens(row: TeamColorsRow): TeamTokens {
  return {
    light: {
      fill: row.fill_hex,
      onFill: row.on_fill_hex,
      accent: row.primary_light_hex,
      second: row.secondary_light_hex,
    },
    dark: {
      fill: row.fill_hex,
      onFill: row.on_fill_hex,
      accent: row.primary_dark_hex,
      second: row.secondary_dark_hex,
    },
  };
}
