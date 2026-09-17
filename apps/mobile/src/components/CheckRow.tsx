import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

type Props = {
  title: string;
  subtitle?: string | null;
  checked: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  trailing?: string | null;
  first?: boolean;
};

export function CheckRow({ title, subtitle, checked, onToggle, disabled, trailing }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      accessibilityLabel={title}
      onPress={onToggle}
      disabled={disabled || !onToggle}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 11,
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          borderWidth: 2,
          borderColor: checked ? theme.accent.fill : c.line,
          backgroundColor: checked ? theme.accent.fill : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Ionicons name="checkmark" size={16} color={theme.accent.onFill} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <Text variant="caption" color="muted">
          {trailing}
        </Text>
      ) : null}
    </Pressable>
  );
}
