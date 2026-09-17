import React from 'react';
import { View } from 'react-native';

import { alpha } from '@/theme/color';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  /** 0 to 1. Values outside are clamped. */
  value: number;
  /** Green instead of the team colour, for something finished. */
  done?: boolean;
  height?: number;
};

/** A filled track in the team colour. */
export function ProgressBar({ value, done = false, height = 8 }: Props) {
  const theme = useTheme();
  const fraction = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 1);
  const fill = done
    ? theme.colors.green
    : theme.accent.themed
      ? theme.accent.text
      : theme.accent.fill;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: alpha(theme.colors.ink, theme.scheme === 'dark' ? 0.1 : 0.07),
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${fraction * 100}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: fill,
        }}
      />
    </View>
  );
}
