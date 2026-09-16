import React from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

type Props = ViewProps & { label?: string };

export function Card({ label, style, children, ...rest }: Props) {
  const theme = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.line,
          borderWidth: 1,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg - 2,
          marginBottom: theme.spacing.md,
        },
        style,
      ]}
    >
      {label ? (
        <Text variant="caption" color="muted" style={{ marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
