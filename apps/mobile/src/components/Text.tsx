import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { ColorTokens, type as typeScale } from '@/theme/tokens';

type Variant = keyof typeof typeScale;

type Props = TextProps & {
  variant?: Variant;
  color?: keyof ColorTokens;
  align?: TextStyle['textAlign'];
};

export function Text({ variant = 'body', color = 'ink', align, style, ...rest }: Props) {
  const theme = useTheme();
  const t = theme.type[variant];
  return (
    <RNText
      {...rest}
      style={[
        {
          fontSize: t.fontSize,
          fontWeight: t.fontWeight,
          lineHeight: t.lineHeight,
          color: theme.colors[color],
          textAlign: align,
        },
        'letterSpacing' in t ? { letterSpacing: t.letterSpacing } : null,
        style,
      ]}
    />
  );
}
