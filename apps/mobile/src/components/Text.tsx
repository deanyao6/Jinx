import React from 'react';
import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';
import type { ColorTokens, type as typeScale } from '@/theme/tokens';

type Variant = keyof typeof typeScale;

type Props = TextProps & {
  variant?: Variant;
  /** A base colour, or `accent` for the team in scope. */
  color?: keyof ColorTokens | 'accent';
  align?: TextStyle['textAlign'];
  /** An Archivo weight React Native's `fontWeight` cannot name, such as 750 or 850. */
  weight?: number;
};

/** `'700'`, `700`, `'bold'` and `undefined` all have to land on a number Archivo has. */
function weightOf(value: TextStyle['fontWeight'], fallback: number): number {
  if (value == null) return fallback;
  if (value === 'bold') return 700;
  if (value === 'normal') return 400;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Text on the screens that have not been rebuilt against `design/reference.html` yet.
 *
 * It renders Archivo, the reference's typeface, rather than the system font. That was the
 * other half of why the sub screens read as a different app: the palette was wrong (see
 * theme/tokens.ts) and so was the face on every line of text.
 *
 * Weight is resolved to a font FAMILY and `fontWeight` is then dropped, including when a
 * caller passed one in `style`. Each generated Archivo instance already carries its weight
 * in the outlines, so leaving `fontWeight` set would make iOS synthesise a second, fake
 * bolding on top of a face that is already bold — see the note in theme/fonts.ts. Doing it
 * here rather than at ~20 call sites means a screen can keep writing the weight it wants in
 * the ordinary way and still get a real instance.
 */
export function Text({
  variant = 'body',
  color = 'ink',
  align,
  weight: exact,
  style,
  ...rest
}: Props) {
  const theme = useTheme();
  const t = theme.type[variant];
  // Flattened so a caller's `fontWeight` — at any depth of nested style arrays — is seen.
  const passed = StyleSheet.flatten(style) as TextStyle | undefined;
  const scaled = 'weight' in t ? t.weight : weightOf(t.fontWeight, 400);
  const weight = exact ?? weightOf(passed?.fontWeight, scaled);
  const width = 'width' in t ? t.width : undefined;
  return (
    <RNText
      {...rest}
      style={[
        {
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          color: color === 'accent' ? theme.accent.text : theme.colors[color],
          textAlign: align,
        },
        'letterSpacing' in t ? { letterSpacing: t.letterSpacing } : null,
        'upper' in t ? { textTransform: 'uppercase' } : null,
        passed,
        // Last, and unconditional: this must beat whatever the caller set.
        { fontFamily: fontFamily({ width, weight }), fontWeight: undefined },
      ]}
    />
  );
}
