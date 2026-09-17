import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { IconName } from '@/components/reference/icons';
import { Button } from './Button';
import { IconTile } from './IconTile';
import { Text } from './Text';

type Props = {
  title: string;
  body?: string;
  actionTitle?: string;
  onAction?: () => void;
  icon?: IconName;
};

export function EmptyState({ title, body, actionTitle, onAction, icon = 'i-ticket' }: Props) {
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
      <View style={{ marginBottom: theme.spacing.sm }}>
        <IconTile icon={icon} size={56} />
      </View>
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
          variant="primary"
          onPress={onAction}
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}
    </View>
  );
}
