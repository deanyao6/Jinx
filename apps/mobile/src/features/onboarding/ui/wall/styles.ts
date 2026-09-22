import type { TextStyle } from 'react-native';

import { fontFamily } from '@/theme/fonts';

/**
 * The welcome screen's own tokens, from the `:root` block and the card rules of
 * `design/welcome-reference.html`. The screen is pinned dark in both appearances: the
 * reference's `.scr` is `#0A0D12` whatever the page theme, so nothing here reads the app theme.
 */
export const WALL = {
  scr: '#0A0D12',
  cream: '#F3EBD3',
  brass: '#D9B65F',
  good: '#3CCB7F',
  bad: '#FF6A60',
  gold: '#FFC425',
  white: '#FFFFFF',
  /** `.c` */
  cardBg: 'rgba(255,255,255,0.085)',
  cardBorder: 'rgba(255,255,255,0.12)',
  /** `.c .meta` */
  meta: 'rgba(255,255,255,0.52)',
  /** `.cta` text */
  onCta: '#0B0E12',
  radius: 12,
  gap: 9,
} as const;

/**
 * `.wall` geometry: `left:-16%; top:-14%; width:132%; height:132%; gap:9px; rotate(-7deg)`.
 * Oversize and tilted so no card edge ever shows at the screen edge.
 */
export const WALL_FRAME = {
  left: '-16%',
  top: '-14%',
  width: '132%',
  height: '132%',
  rotate: '-7deg',
} as const;

/**
 * Text on the wall. The reference sets `font-variation-settings:"wdth"` and `font-weight`;
 * the app has 19 static Archivo instances, so each pair snaps to the nearest one that exists
 * (`theme/fonts.ts`): `.c b` at 80/800 draws in 80/850, `.buddy .rec` and `.pledge .odds` at
 * 70/900 draw in 70/850. Everything else is exact. Sizes and line heights are the CSS values
 * (line-height 1.3 on `.c`, 1 on `.stub .jx` and `.wrapped .yr`).
 *
 * `allowFontScaling` is off on every wall card: the wall is decoration, and a card that
 * reflows with Dynamic Type would tear the columns.
 */
export function wallText(o: {
  size: number;
  line?: number;
  width?: number;
  weight?: number;
  color?: string;
  spacing?: number;
}): TextStyle {
  return {
    fontFamily: fontFamily({ width: o.width ?? 100, weight: o.weight ?? 400 }),
    fontSize: o.size,
    lineHeight: o.line ?? Math.round(o.size * 1.3 * 100) / 100,
    color: o.color ?? WALL.white,
    letterSpacing: o.spacing,
  };
}

/** `.c b`: 12.5px, weight 800 at width 80, 2px under. */
export const CARD_TITLE = wallText({ size: 12.5, line: 16.25, width: 80, weight: 800 });
/** `.c .meta`: 10px at 52% white. */
export const CARD_META = wallText({ size: 10, line: 13, color: WALL.meta });
