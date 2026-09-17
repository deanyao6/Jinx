import React from 'react';
import { Pressable, View } from 'react-native';

import { IconTile } from '@/components/IconTile';
import { IconCheckC, type IconName } from '@/components/reference/icons';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  icon: IconName;
  title: string;
  description?: string | null;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
};

/**
 * One choice in a picker, as a card: an icon tile, a title and a line of help. The chosen one
 * takes the team colour (a washed fill, a solid tile and a check); the rest stay plain cards.
 */
export function OptionCard({
  icon,
  title,
  description,
  selected,
  onPress,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        backgroundColor: selected ? theme.accent.wash : theme.colors.card,
        borderRadius: theme.radius.lg,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md + 2,
        marginBottom: theme.spacing.sm,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <IconTile icon={icon} solid={selected} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" color={selected ? 'accent' : 'ink'}>
          {title}
        </Text>
        {description ? (
          <Text variant="caption" color="muted" style={{ marginTop: 1 }}>
            {description}
          </Text>
        ) : null}
      </View>
      {selected ? <IconCheckC size={20} color={theme.accent.text} /> : null}
    </Pressable>
  );
}
