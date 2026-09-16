import { useFonts } from 'expo-font';
import type { FontSource } from 'expo-font';

/**
 * Archivo, as static instances (SPEC.md 8.2).
 *
 * `design/reference.html` loads Archivo as a variable font and reaches for the width axis with
 * `font-variation-settings:"wdth" N`. React Native has no reliable support for variable font
 * axes, so `scripts/fonts/build-archivo.py` pins every (width, weight) pair the reference
 * actually uses into its own static TTF under `apps/mobile/assets/fonts/`, and this module
 * registers them with expo-font.
 *
 * Because each instance already carries its weight in the outlines, styles that use one of these
 * families must NOT also set `fontWeight`: iOS would synthesise a second, fake bolding on top.
 * Ask for the weight through {@link fontFamily} instead.
 *
 * Regenerate the assets and then update {@link FONT_INSTANCES} and {@link FONT_ASSETS} to match:
 *
 *     python3 scripts/fonts/build-archivo.py
 */

/**
 * Every generated instance as `[width, weight]`, in the same order as
 * `INSTANCES` in `scripts/fonts/build-archivo.py`. The two lists must agree; the unit test in
 * `__tests__/fonts.test.ts` checks each entry has a real file on disk.
 */
export const FONT_INSTANCES = [
  [62, 900],
  [64, 900],
  [66, 900],
  [70, 700],
  [70, 850],
  [72, 850],
  [74, 850],
  [78, 850],
  [80, 850],
  [80, 900],
  [100, 400],
  [100, 500],
  [100, 600],
  [100, 650],
  [100, 700],
  [100, 750],
  [100, 800],
  [100, 850],
  [100, 900],
] as const;

/** A width the reference asks for and that we have a real instance of. */
export type FontWidth = (typeof FONT_INSTANCES)[number][0];

/** A weight the reference asks for and that we have a real instance of. */
export type FontWeight = (typeof FONT_INSTANCES)[number][1];

/** The name a generated instance is registered and referenced under. Matches its filename. */
export type FontFamilyName = `Archivo_wdth${number}_wght${number}`;

/** The reference's `body` rule: Archivo at the default width, regular weight. */
export const DEFAULT_WIDTH = 100;
export const DEFAULT_WEIGHT = 400;

function nameOf(width: number, weight: number): FontFamilyName {
  return `Archivo_wdth${width}_wght${weight}`;
}

/**
 * The map handed to expo-font. Every `require` is written out literally because Metro resolves
 * asset requires statically and cannot follow a computed path.
 */
export const FONT_ASSETS: Record<FontFamilyName, FontSource> = {
  Archivo_wdth62_wght900: require('../../assets/fonts/Archivo_wdth62_wght900.ttf') as FontSource,
  Archivo_wdth64_wght900: require('../../assets/fonts/Archivo_wdth64_wght900.ttf') as FontSource,
  Archivo_wdth66_wght900: require('../../assets/fonts/Archivo_wdth66_wght900.ttf') as FontSource,
  Archivo_wdth70_wght700: require('../../assets/fonts/Archivo_wdth70_wght700.ttf') as FontSource,
  Archivo_wdth70_wght850: require('../../assets/fonts/Archivo_wdth70_wght850.ttf') as FontSource,
  Archivo_wdth72_wght850: require('../../assets/fonts/Archivo_wdth72_wght850.ttf') as FontSource,
  Archivo_wdth74_wght850: require('../../assets/fonts/Archivo_wdth74_wght850.ttf') as FontSource,
  Archivo_wdth78_wght850: require('../../assets/fonts/Archivo_wdth78_wght850.ttf') as FontSource,
  Archivo_wdth80_wght850: require('../../assets/fonts/Archivo_wdth80_wght850.ttf') as FontSource,
  Archivo_wdth80_wght900: require('../../assets/fonts/Archivo_wdth80_wght900.ttf') as FontSource,
  Archivo_wdth100_wght400: require('../../assets/fonts/Archivo_wdth100_wght400.ttf') as FontSource,
  Archivo_wdth100_wght500: require('../../assets/fonts/Archivo_wdth100_wght500.ttf') as FontSource,
  Archivo_wdth100_wght600: require('../../assets/fonts/Archivo_wdth100_wght600.ttf') as FontSource,
  Archivo_wdth100_wght650: require('../../assets/fonts/Archivo_wdth100_wght650.ttf') as FontSource,
  Archivo_wdth100_wght700: require('../../assets/fonts/Archivo_wdth100_wght700.ttf') as FontSource,
  Archivo_wdth100_wght750: require('../../assets/fonts/Archivo_wdth100_wght750.ttf') as FontSource,
  Archivo_wdth100_wght800: require('../../assets/fonts/Archivo_wdth100_wght800.ttf') as FontSource,
  Archivo_wdth100_wght850: require('../../assets/fonts/Archivo_wdth100_wght850.ttf') as FontSource,
  Archivo_wdth100_wght900: require('../../assets/fonts/Archivo_wdth100_wght900.ttf') as FontSource,
};

/** Widths we have at least one instance of, ascending. */
export const FONT_WIDTHS: readonly number[] = [
  ...new Set(FONT_INSTANCES.map(([width]) => width)),
].sort((a, b) => a - b);

/** Weights available at each width, ascending. Not every width carries every weight. */
const WEIGHTS_BY_WIDTH: ReadonlyMap<number, readonly number[]> = (() => {
  const byWidth = new Map<number, number[]>();
  for (const [width, weight] of FONT_INSTANCES) {
    const weights = byWidth.get(width);
    if (weights) weights.push(weight);
    else byWidth.set(width, [weight]);
  }
  for (const weights of byWidth.values()) weights.sort((a, b) => a - b);
  return byWidth;
})();

/** The value in `values` closest to `target`, or `fallback` when `values` is empty. */
function nearest(values: readonly number[], target: number, fallback: number): number {
  let best = fallback;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const value of values) {
    const distance = Math.abs(value - target);
    // Strictly less, so ties go to the earlier (smaller, since the lists are sorted) value.
    if (distance < bestDistance) {
      bestDistance = distance;
      best = value;
    }
  }
  return best;
}

/**
 * The family name to use for a given width and weight.
 *
 * Nearest-match fallback: we only ship the pairs the reference actually uses, but callers are
 * free to ask for anything, so this snaps rather than failing. It picks the closest available
 * *width* first and only then the closest weight within that width, because a wrong width is far
 * more visible than a wrong weight - rendering a 62-wide condensed record number at width 100
 * changes the layout, while 850 instead of 900 is a shade of heaviness. The result is always a
 * family that exists in {@link FONT_ASSETS}, so this never returns undefined and callers never
 * need a null check. If you find yourself relying on the fallback for a real screen, add the pair
 * to `INSTANCES` in `scripts/fonts/build-archivo.py` and regenerate instead.
 */
export function fontFamily(
  options: { width?: number | undefined; weight?: number | undefined } = {},
): FontFamilyName {
  const width = nearest(FONT_WIDTHS, options.width ?? DEFAULT_WIDTH, DEFAULT_WIDTH);
  const weights = WEIGHTS_BY_WIDTH.get(width) ?? [];
  const weight = nearest(weights, options.weight ?? DEFAULT_WEIGHT, DEFAULT_WEIGHT);
  return nameOf(width, weight);
}

/**
 * Loads every Archivo instance. Returns `[loaded, error]` exactly like expo-font's `useFonts`.
 *
 * The caller must not render text until `loaded` is true, or the first frame paints in the system
 * font and visibly reflows when Archivo arrives.
 */
export function useJinxFonts(): [boolean, Error | null] {
  return useFonts(FONT_ASSETS);
}
