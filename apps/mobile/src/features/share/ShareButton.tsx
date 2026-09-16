import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  onPress: () => void;
  label?: string;
  size?: number;
  style?: ViewStyle;
};

/** Round share icon button used in headers and on rows. */
export function ShareButton({ onPress, label = 'Share', size = 36, style }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.tint,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        },
        style,
      ]}
    >
      <Ionicons name="share-outline" size={Math.round(size * 0.55)} color={c.ink} />
    </Pressable>
  );
}
