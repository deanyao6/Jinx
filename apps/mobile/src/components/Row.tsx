import React from 'react';
import { Pressable, View } from 'react-native';

import { IconChevR, type IconName } from '@/components/reference/icons';
import { useTheme } from '@/theme/ThemeProvider';
import { IconTile } from './IconTile';
import { Text } from './Text';

type Props = {
  title: string;
  subtitle?: string | null;
  /** A leading icon on a tile in the team colour. */
  icon?: IconName;
  right?: React.ReactNode;
  onPress?: () => void;
  /** Kept for callers that pass it. Rows are separated by space now, not by a rule. */
  first?: boolean;
  chevron?: boolean;
  accessibilityLabel?: string;
};

/** List row. Rows in a card are set apart by their own padding; there is no line between them. */
export function Row({ title, subtitle, icon, right, onPress, chevron, accessibilityLabel }: Props) {
  const theme = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 12 }}>
      {icon ? <IconTile icon={icon} /> : null}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="muted" style={{ marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? <IconChevR size={16} color={theme.colors.muted} /> : null}
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
