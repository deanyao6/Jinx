import React from 'react';
import { View } from 'react-native';

import { ICONS, type IconName } from '@/components/reference/icons';
import { alpha } from '@/theme/color';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  icon: IconName;
  size?: number;
  solid?: boolean;
  /** Gold instead of the team colour, for a rarity such as a famous game. */
  gold?: boolean;
};

/** An icon on a rounded tile washed in the team colour. Leads a row, or tops an empty state. */
export function IconTile({ icon, size = 38, solid = false, gold = false }: Props) {
  const theme = useTheme();
  const Icon = ICONS[icon];
  const goldColor = theme.colors.gold;
  const goldWash = alpha(goldColor, theme.scheme === 'dark' ? 0.18 : 0.14);
  const background = gold
    ? solid
      ? goldColor
      : goldWash
    : solid
      ? theme.accent.fill
      : theme.accent.wash;
  const ink = gold
    ? solid
      ? theme.colors.onInk
      : goldColor
    : solid
      ? theme.accent.onFill
      : theme.accent.text;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={size * 0.52} color={ink} />
    </View>
  );
}
