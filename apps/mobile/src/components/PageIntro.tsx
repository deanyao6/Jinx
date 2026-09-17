import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

type Props = {
  /** Small capitals above the title, in the team colour: "2026", "MLB". */
  kicker?: string | null;
  title: string;
  body?: string | null;
};

/** The top of a sub page: a kicker in the team colour, a condensed heavy title, one line of help. */
export function PageIntro({ kicker, title, body }: Props) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing.lg, gap: 4 }}>
      {kicker ? (
        <Text variant="kicker" color="accent">
          {kicker}
        </Text>
      ) : null}
      <Text variant="h1" accessibilityRole="header">
        {title}
      </Text>
      {body ? (
        <Text variant="sub" color="muted" style={{ marginTop: 2 }}>
          {body}
        </Text>
      ) : null}
    </View>
  );
}
