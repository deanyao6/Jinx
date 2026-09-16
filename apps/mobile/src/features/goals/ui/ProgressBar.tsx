import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type Props = { ratio: number; done?: boolean; height?: number };

/** Rounded bar in the tint color with a blue fill, green when done (mockup screen 5). */
export function ProgressBar({ ratio, done = false, height = 8 }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={{
        height,
        borderRadius: theme.radius.pill,
        backgroundColor: c.tint,
        overflow: 'hidden',
        marginTop: 8,
        marginBottom: 4,
      }}
    >
      <View
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: theme.radius.pill,
          backgroundColor: done ? c.green : c.blue,
        }}
      />
    </View>
  );
}
