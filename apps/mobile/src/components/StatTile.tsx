import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

type Props = {
  label: string;
  value: string;
  /** A line under the value: ".646 pct", "3 this year". */
  note?: string | null;
  /** Draws the value in the team colour. */
  accent?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

/** A small filled tile with a condensed number, like the Passport's record cards. */
export function StatTile({ label, value, note, accent = false, onPress, style }: Props) {
  const theme = useTheme();
  const body = (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.lg,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md + 2,
          gap: 2,
        },
        style,
      ]}
    >
      <Text variant="kicker" color="muted" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="stat" color={accent ? 'accent' : 'ink'} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {note ? (
        <Text variant="caption" color="muted" numberOfLines={1}>
          {note}
        </Text>
      ) : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })}
    >
      {body}
    </Pressable>
  );
}
