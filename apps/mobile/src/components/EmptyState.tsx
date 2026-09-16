import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

type Props = {
  title: string;
  body?: string;
  actionTitle?: string;
  onAction?: () => void;
};

export function EmptyState({ title, body, actionTitle, onAction }: Props) {
  const theme = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: theme.spacing.xxl,
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.sm,
      }}
    >
      <Text variant="h2" align="center">
        {title}
      </Text>
      {body ? (
        <Text color="muted" align="center">
          {body}
        </Text>
      ) : null}
      {actionTitle && onAction ? (
        <Button
          title={actionTitle}
          variant="secondary"
          onPress={onAction}
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}
    </View>
  );
}
