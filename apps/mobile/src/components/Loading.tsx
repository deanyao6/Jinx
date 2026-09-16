import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

export function Loading({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View
      style={{ alignItems: 'center', paddingVertical: theme.spacing.xl, gap: theme.spacing.sm }}
    >
      <ActivityIndicator color={theme.colors.muted} />
      {label ? (
        <Text variant="caption" color="muted">
          {label}
        </Text>
      ) : null}
    </View>
  );
}
