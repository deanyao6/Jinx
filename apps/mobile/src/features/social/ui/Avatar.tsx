import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

const ACCENTS = ['green', 'blue', 'red', 'gold'] as const;

function accentFor(seed: string): (typeof ACCENTS)[number] {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length] as (typeof ACCENTS)[number];
}

/** Initial-letter circle like the mockup's `.av`. No photos in v1. */
export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const theme = useTheme();
  const initial = (name.trim().replace(/^@/, '')[0] ?? '?').toUpperCase();
  return (
    <View
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors[accentFor(name)],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        variant="bodyStrong"
        style={{ color: '#FFFFFF', fontSize: size * 0.42, lineHeight: size * 0.5 }}
      >
        {initial}
      </Text>
    </View>
  );
}
