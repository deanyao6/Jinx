import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';
import { Notice, errorMessage } from './Notice';
import { Text } from './Text';

type Props = {
  error: unknown;
  /** Usually the query's refetch. Shows a "Try again" button when present. */
  onRetry?: () => unknown;
  /** Overrides the error's own message. */
  message?: string;
  style?: ViewStyle;
};

/** Error notice with a retry action, for every query error in the app. */
export function ErrorNotice({ error, onRetry, message, style }: Props) {
  const theme = useTheme();
  return (
    <Notice tone="error" style={style}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Text variant="sub" color="red" style={{ flex: 1 }}>
          {message ?? errorMessage(error)}
        </Text>
        {onRetry ? (
          <Button title="Try again" variant="ghost" small onPress={() => void onRetry()} />
        ) : null}
      </View>
    </Notice>
  );
}

/**
 * Shown when a refetch failed but cached data is still on screen (offline, or the server is
 * unreachable). Subtle on purpose: the data below is still useful.
 */
export function StaleNotice({ onRetry, style }: { onRetry?: () => unknown; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <Notice style={style}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Text variant="caption" color="muted" style={{ flex: 1 }}>
          You seem to be offline. Showing what was saved on this phone.
        </Text>
        {onRetry ? (
          <Button title="Retry" variant="ghost" small onPress={() => void onRetry()} />
        ) : null}
      </View>
    </Notice>
  );
}
