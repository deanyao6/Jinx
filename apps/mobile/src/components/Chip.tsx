import React from 'react';
import { Pressable, type ViewStyle } from 'react-native';

import { alpha } from '@/theme/color';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  accent?: 'green' | 'ink';
};

/** A filled pill. Selected is the team colour; `green` is for a state, not a choice. */
export function Chip({ label, selected = false, onPress, style, accent = 'ink' }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const green = accent === 'green';
  const background = selected
    ? green
      ? alpha(c.green, 0.16)
      : theme.accent.fill
    : // A wash of ink rather than the card colour, so an unselected chip shows up on a card as
      // well as on the canvas.
      alpha(c.ink, theme.scheme === 'dark' ? 0.08 : 0.06);
  const color = selected ? (green ? c.green : theme.accent.onFill) : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        {
          borderRadius: theme.radius.pill,
          backgroundColor: background,
          paddingVertical: 7,
          paddingHorizontal: 13,
          opacity: pressed ? 0.7 : 1,
          marginRight: 6,
          marginBottom: 6,
        },
        style,
      ]}
    >
      <Text variant="caption" weight={selected ? 750 : 600} style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}
