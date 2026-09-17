import React from 'react';
import { View } from 'react-native';

import { Avatar } from '@/components/reference/Avatar';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  /** The avatar key: a user or person id in real data, a fixture name in demo mode. */
  seed: string;
  /** Diameter of the portrait itself. The ring and its gap are added outside it. */
  size?: number;
};

/**
 * The reference portrait inside a ring in the colour of the team in scope, the way the Profile
 * tab and the Friends panel draw a person. Wrap it in a `TeamTheme` to ring someone in their
 * own team's colour. The ring is art, like the one in the reference, not a card outline.
 */
export function RingedAvatar({ seed, size = 38 }: Props) {
  const theme = useTheme();
  const ring = size >= 64 ? 3 : 2;
  const outer = size + ring * 4;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: outer,
        height: outer,
        borderRadius: outer / 2,
        borderWidth: ring,
        borderColor: theme.accent.text,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        <Avatar name={seed} size={size} />
      </View>
    </View>
  );
}
