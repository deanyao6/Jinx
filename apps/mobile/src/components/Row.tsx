import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

type Props = {
  title: string;
  subtitle?: string | null;
  right?: React.ReactNode;
  onPress?: () => void;
  first?: boolean;
  chevron?: boolean;
  accessibilityLabel?: string;
};

/** List row with a hairline divider, matching the mockup's ranked lists. */
export function Row({
  title,
  subtitle,
  right,
  onPress,
  first,
  chevron,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.line,
        gap: 10,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={16} color={c.muted} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {body}
    </Pressable>
  );
}
