/**
 * Palettes belonging to the reference's SVG generators.
 *
 * These are part of the design, not data: `seal()` picks its metal from METAL, `avatar()`
 * picks its three colours from AVATARS, and `scene()` picks a sky from PHOTO_SKIES. A
 * component needs them whether it is drawing demo fixtures or a real user's photo, so they
 * live with the components rather than with the demo data.
 */

/**
 * Seal metals: [highlight, base, engraving].
 *
 * Brass and silver are the reference's, verbatim. Gold is not in the reference: it is the
 * golden stamp, struck when something rare happened at the stadium (features/eggs).
 */
export const METAL: Record<'brass' | 'silver' | 'gold', readonly [string, string, string]> = {
  brass: ['#F3EBD3', '#D9C79C', '#6E5A33'],
  silver: ['#EEF0F2', '#C5CAD0', '#4A5260'],
  gold: ['#FFF0B3', '#E0AE33', '#5E3F06'],
};

/** The outer dashed rule of a golden seal. Mid gold, so it shows on a light and a dark page. */
export const SEAL_GOLD_RING = '#C2922A';

/**
 * A stadium with no team to take its colours from: a closed park, a neutral site. Dark slate,
 * engraved the same way as a team seal. `second` is per appearance because it is drawn on
 * the page, outside the disc.
 */
export const SEAL_SLATE = {
  fill: '#2E3641',
  onFill: '#E7EAEE',
  second: { light: '#5B6573', dark: '#8A94A3' },
} as const;

/** Generated avatar palettes: [skin, hair, background]. */
export const AVATARS: Record<string, readonly [string, string, string]> = {
  dean: ['#F3C9A5', '#2B2118', '#7FB3D5'],
  dad: ['#D9A57A', '#8A8A8A', '#9BC7A6'],
  maya: ['#C98A62', '#3A2317', '#E8B4C8'],
  jordan: ['#8D5A3B', '#1D1D1D', '#F2C26B'],
  priya: ['#B97A55', '#241612', '#A7B8F0'],
  sam: ['#F0CFB0', '#C9772E', '#B5DDD1'],
};

/** Placeholder photo skies, chosen by `seed % 3` in the reference's `scene()`. */
export const PHOTO_SKIES: readonly string[] = ['#1D2B53', '#243B6B', '#3B2C5A'];
