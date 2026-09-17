import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { alpha } from '@/theme/color';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

type Props = {
  children: React.ReactNode;
  tone?: 'info' | 'error' | 'success';
  style?: ViewStyle;
};

export function Notice({ children, tone = 'info', style }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const color = tone === 'error' ? 'red' : tone === 'success' ? 'green' : 'ink';
  return (
    <View
      accessibilityRole="alert"
      style={[
        {
          backgroundColor:
            tone === 'error'
              ? alpha(c.red, 0.12)
              : tone === 'success'
                ? alpha(c.green, 0.13)
                : theme.accent.wash,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.md,
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text variant="sub" color={color}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') {
    return e.message;
  }
  return 'Something went wrong. Try again.';
}
