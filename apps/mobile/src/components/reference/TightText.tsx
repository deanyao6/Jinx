import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

/**
 * Text whose CSS line box is shorter than its glyphs, which is what a `line-height` below
 * 1 means. The reference does this in three places: `.fx-word` at `.85`, `.fx-rec b` at
 * `.78` and `.loghead b` at `.85`.
 *
 * In CSS the line box is that height and the glyphs overflow it, because half-leading goes
 * negative. React Native cannot express that: a `lineHeight` shorter than the font's line
 * compresses the line and moves the baseline up, and on iOS it also clips the descender.
 * Measured on the Passport wordmark, that put the glyphs 2pt high and cut 1.3pt off the J.
 *
 * So the Text keeps its natural line and is offset to put its baseline exactly where CSS
 * would. The offset is derived from Archivo's own metrics rather than tuned by eye:
 *
 *   CSS baseline from the block's top = (lineBox - contentHeight) / 2 + ascent
 *   React Native draws the baseline at = ascent from the Text's top
 *   so the Text's top must sit at      = the difference, which is CSS half-leading
 *
 * The second line is the part worth knowing, and I got it wrong first: I assumed iOS used
 * `usWinAscent` (1.100em), which put the wordmark 6.7pt too high. Measuring the rendered
 * glyphs showed it uses the hhea ascent (0.878em), so the ascent terms cancel and the
 * offset is exactly half-leading. That is a satisfying answer rather than a fudge factor,
 * and it means the same formula holds at any size.
 */

/**
 * Archivo's vertical metrics, as fractions of the em. Read straight out of the generated
 * TTFs; every static instance shares them.
 *
 *   hhea ascent 878, descent -210, lineGap 0  ->  content height 1.088em
 */
const ARCHIVO = {
  /** hhea ascent 878 minus descent -210, over a 1000 unit em. */
  contentHeight: 1.088,
} as const;

/**
 * Where the Text's top must sit, relative to the top of the CSS line box.
 *
 * This is CSS half-leading. It is negative whenever the line box is shorter than the
 * font's own line, which is exactly the case this component exists for.
 */
export function tightTextOffset(fontSize: number, lineBox: number): number {
  return (lineBox - ARCHIVO.contentHeight * fontSize) / 2;
}

/**
 * Margins belong to the block, not to the glyphs.
 *
 * Passing a style with `marginTop` straight to the inner Text adds it to the half-leading
 * offset and moves the text inside its own line box, which is not what the CSS margin
 * does. That regressed four screens before I noticed: the reference's `.loghead b` and
 * `.fx-rc b` both carry margins, and the two places without them were the two that worked.
 */
const MARGIN_KEYS = [
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'marginStart',
  'marginEnd',
] as const;

function splitMargins(style: StyleProp<TextStyle>): [ViewStyle, TextStyle] {
  const flat = StyleSheet.flatten(style) ?? {};
  const wrapper: Record<string, unknown> = {};
  const text: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    if ((MARGIN_KEYS as readonly string[]).includes(key)) wrapper[key] = value;
    else text[key] = value;
  }
  return [wrapper as ViewStyle, text as TextStyle];
}

export function TightText({
  fontSize,
  lineHeight,
  style,
  children,
}: {
  fontSize: number;
  /** The CSS line-height multiplier, e.g. 0.85. */
  lineHeight: number;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
}) {
  const lineBox = fontSize * lineHeight;
  const [wrapperStyle, textStyle] = splitMargins(style);
  return (
    // The wrapper occupies the CSS line box; the glyphs overflow it, as they do in CSS.
    <View style={[{ height: lineBox }, wrapperStyle]}>
      <Text
        allowFontScaling={false}
        style={[{ fontSize, marginTop: tightTextOffset(fontSize, lineBox) }, textStyle]}
      >
        {children}
      </Text>
    </View>
  );
}
