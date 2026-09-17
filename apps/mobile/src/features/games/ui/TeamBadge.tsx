import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  /** The abbreviation: "PHI". */
  label: string;
  size?: number;
};

/**
 * The reference's circular `.fx-bd` badge for the screens outside it: the team's fill, a ring in
 * its second colour, the abbreviation in condensed heavy type. It draws the team in scope, so
 * wrap it in `SideTheme`. Pick a side and Relive each keep their own pixel-matched copy.
 */
export function TeamBadge({ label, size = 46 }: Props) {
  const { accent } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: size >= 56 ? 3 : 2.5,
        borderColor: accent.second,
        backgroundColor: accent.solid,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        variant="h2"
        weight={900}
        numberOfLines={1}
        style={{ color: accent.onSolid, fontSize: size * 0.29, lineHeight: size * 0.38 }}
      >
        {label}
      </Text>
    </View>
  );
}
