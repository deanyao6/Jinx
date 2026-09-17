import React from 'react';
import { Switch, View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  title: string;
  /** One line (or a short paragraph) on what the switch does. */
  body?: string | null;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

/**
 * A setting with a switch. On is the colour of the team in scope. Rows are set apart by their
 * padding, never by a rule.
 */
export function ToggleRow({ title, body, value, onValueChange, disabled }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11 }}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        {body ? (
          <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
            {body}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={title}
        trackColor={{ true: theme.accent.fill, false: c.line }}
        ios_backgroundColor={c.line}
        // On, the thumb is whatever reads on the team colour. With no team the fill is ink,
        // which is near white in the dark, and the system's white thumb would vanish into it.
        thumbColor={value ? theme.accent.onFill : undefined}
      />
    </View>
  );
}
