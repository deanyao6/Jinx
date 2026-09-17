import React from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

type Props = {
  title: string;
  /** A short action on the right, in the team colour: "View all (12)". */
  action?: string;
  onAction?: () => void;
};

/** The Passport's section heading: condensed heavy capitals, with an optional action. */
export function SectionHeader({ title, action, onAction }: Props) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginTop: theme.spacing.sm,
        marginBottom: 10,
      }}
    >
      <Text variant="section" accessibilityRole="header">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}>
          <Text variant="caption" color="accent" weight={750}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
