import { luminance } from '@/theme/color';
import { darkBase, lightBase } from '@/theme/reference/tokens';

import { METAL, SEAL_GOLD_RING } from './palettes';

/**
 * What a seal is struck in.
 *
 * `brass` and `silver` are the reference's two metals and draw exactly as
 * `design/reference.html` does. `gold` is the golden stamp. A tint is a team's colours: the
 * disc is the team fill, the rim and the dashed outer rule are its second colour, and the
 * engraving is whatever the team writes on its fill.
 */
export type SealTint = { fill: string; second: string; onFill: string };
export type SealMetal = 'brass' | 'silver' | 'gold' | SealTint;

export type SealColors = {
  /** The hot spot of the disc's radial gradient, up and to the left. */
  highlight: string;
  /** The rest of the disc. */
  base: string;
  /** Ring text, the stadium, the inner rule and the baseline. */
  engraving: string;
  /** The stroke round the disc. */
  rim: string;
  /** The dotted inner ring: decoration, so it may be the second colour where that shows. */
  detail: string;
  /** The outer dashed rule. Null means "the caller's ink", which is what the reference does. */
  ring: string | null;
};

/** Contrast the engraving must reach on the body of the disc (WCAG AA for text). */
export const ENGRAVING_CONTRAST = 4.5;
/** And on the highlight, which covers a small part of the ring text. */
export const HIGHLIGHT_CONTRAST = 3;

function channels(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return [parseInt(m[1] as string, 16), parseInt(m[2] as string, 16), parseInt(m[3] as string, 16)];
}

/** `a` moved `t` of the way to `b`, as `#RRGGBB`. Returns `a` when either is not a hex. */
export function mix(a: string, b: string, t: number): string {
  const ca = channels(a);
  const cb = channels(b);
  if (!ca || !cb) return a;
  const k = Math.min(Math.max(t, 0), 1);
  return `#${ca
    .map((v, i) =>
      Math.round(v + ((cb[i] as number) - v) * k)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;
}

/** WCAG contrast ratio between two `#RRGGBB` colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function isTint(metal: SealMetal): metal is SealTint {
  return typeof metal === 'object';
}

/**
 * A team's colours as an engraved disc.
 *
 * The engraving is always the team's own `onFill`, because that pair is the one the palette
 * was tuned for, and what changes is the disc under it:
 *
 * - The body is the team fill. Where the fill is too bright for its own text (the Giants'
 *   orange holds white at about 3:1) it is deepened a step at a time until the engraving
 *   reaches 4.5:1, so the ring text reads at five points high.
 * - The highlight is the fill lifted toward white, as much as it can be while the engraving
 *   still holds 3:1 on it. A near-black fill (the Raiders, the Bears' navy) takes the full
 *   lift and comes out as gunmetal with a visible sheen; a bright one takes almost none.
 *
 * The second colour is the rim and the outer dashed rule, which is what keeps a near-black
 * disc from dissolving into a dark screen. The caller resolves it for the appearance in force.
 *
 * The outer rule is drawn on the page, not on the disc, and several second colours are a
 * gold or a silver that a white card swallows (the Packers' gold is 1.8:1 on white). Given
 * the page's ink, the rule is moved toward it until it holds 3:1 on the page the ink implies,
 * which turns that gold into a bronze of the same hue. The rim keeps the true colour: it sits
 * against the disc, which carries it.
 */
export function tintColors(tint: SealTint, inkColor?: string): SealColors {
  const { fill, second, onFill } = tint;
  const away = luminance(onFill) >= luminance(fill) ? '#000000' : '#FFFFFF';

  let base = fill;
  for (let step = 1; step <= 20 && contrast(onFill, base) < ENGRAVING_CONTRAST; step += 1) {
    base = mix(fill, away, step * 0.04);
  }

  let highlight = mix(base, '#FFFFFF', 0.06);
  for (const lift of [0.3, 0.24, 0.18, 0.12, 0.06, 0]) {
    const candidate = mix(fill, '#FFFFFF', lift);
    if (contrast(onFill, candidate) >= HIGHLIGHT_CONTRAST) {
      highlight = candidate;
      break;
    }
  }

  return {
    highlight,
    base,
    engraving: onFill,
    rim: second,
    detail: contrast(second, base) >= 1.8 ? second : onFill,
    ring: inkColor ? visibleOnPage(second, inkColor) : second,
  };
}

/** Contrast the outer dashed rule must reach against the page it is drawn on. */
export const RING_CONTRAST = 3;

/**
 * `color`, moved toward the page's ink until it shows on that page.
 *
 * The seal is never told its background, only the ink drawn on it, and that is enough: dark
 * ink means a light page and light ink a dark one. Judged against the harder surface of that
 * appearance, so a card and the canvas behind it both pass.
 */
export function visibleOnPage(color: string, inkColor: string): string {
  // The harder of the two surfaces in each appearance: the grey canvas under a dark rule,
  // the raised card under a light one.
  const page = luminance(inkColor) < 0.18 ? lightBase.canvas : darkBase.card;
  let out = color;
  for (let step = 1; step <= 20 && contrast(out, page) < RING_CONTRAST; step += 1) {
    out = mix(color, inkColor, step * 0.05);
  }
  return out;
}

/** The colours for any metal or tint. Brass and silver come back exactly as the reference has them. */
export function sealColors(metal: SealMetal, inkColor?: string): SealColors {
  if (isTint(metal)) return tintColors(metal, inkColor);
  const [highlight, base, engraving] = METAL[metal];
  return {
    highlight,
    base,
    engraving,
    rim: engraving,
    detail: engraving,
    ring: metal === 'gold' ? SEAL_GOLD_RING : null,
  };
}
