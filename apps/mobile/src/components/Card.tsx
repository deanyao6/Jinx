import React from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

type Props = ViewProps & {
  label?: string;
  /**
   * `plain` is a filled card on the canvas. `accent` washes it in the colour of the team in
   * scope, for the one card on a screen that matters most. `solid` fills it with the team
   * colour outright, for a hero.
   */
  tone?: 'plain' | 'accent' | 'solid';
};

/** A filled card with no outline: the fill against the canvas is the edge. */
export function Card({ label, tone = 'plain', style, children, ...rest }: Props) {
  const theme = useTheme();
  const background =
    tone === 'solid'
      ? theme.accent.fill
      : tone === 'accent'
        ? theme.accent.wash
        : theme.colors.card;
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: background,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
          marginBottom: theme.spacing.md,
        },
        style,
      ]}
    >
      {label ? (
        <Text
          variant="kicker"
          color={tone === 'plain' ? 'muted' : 'accent'}
          style={[{ marginBottom: 8 }, tone === 'solid' ? { color: theme.accent.onFill } : null]}
        >
          {label}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
