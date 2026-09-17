import React from 'react';
import { Pressable } from 'react-native';

import { Text } from '@/components/Text';
import { IconChevL } from '@/components/reference/icons';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * "Back" at the top of a screen with no navigator header (sign-in and onboarding hide theirs).
 * A chevron and the word in the accent, flush with the screen's left edge, where a ghost button's
 * own padding left it indented against the title below.
 */
export function BackLink({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 2,
        minHeight: 36,
        marginLeft: -4,
        marginBottom: theme.spacing.md,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <IconChevL size={18} color={theme.accent.text} />
      <Text variant="sub" color="accent" weight={750}>
        Back
      </Text>
    </Pressable>
  );
}
