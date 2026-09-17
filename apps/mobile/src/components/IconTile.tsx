import React from 'react';
import { View } from 'react-native';

import { ICONS, type IconName } from '@/components/reference/icons';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { icon: IconName; size?: number; solid?: boolean };

/** An icon on a rounded tile washed in the team colour. Leads a row, or tops an empty state. */
export function IconTile({ icon, size = 38, solid = false }: Props) {
  const theme = useTheme();
  const Icon = ICONS[icon];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: solid ? theme.accent.fill : theme.accent.wash,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={size * 0.52} color={solid ? theme.accent.onFill : theme.accent.text} />
    </View>
  );
}
