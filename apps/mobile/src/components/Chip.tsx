import React from 'react';
import { Pressable, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  accent?: 'green' | 'ink';
};

export function Chip({ label, selected = false, onPress, style, accent = 'ink' }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const color = accent === 'green' ? c.green : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        {
          borderRadius: theme.radius.pill,
          borderWidth: 1.5,
          borderColor: selected ? color : c.line,
          backgroundColor: selected && accent === 'ink' ? c.ink : c.card,
          paddingVertical: 6,
          paddingHorizontal: 12,
          opacity: pressed ? 0.7 : 1,
          marginRight: 6,
          marginBottom: 6,
        },
        style,
      ]}
    >
      <Text
        variant="caption"
        style={{
          fontWeight: selected ? '700' : '400',
          color: selected ? (accent === 'ink' ? c.onInk : c.green) : c.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
