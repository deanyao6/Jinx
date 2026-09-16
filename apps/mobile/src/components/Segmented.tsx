import React from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

type Props<T extends string> = {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
};

export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: c.tint,
        borderRadius: theme.radius.md,
        padding: 3,
        marginBottom: theme.spacing.md,
      }}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: theme.radius.sm,
              backgroundColor: on ? c.card : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text
              variant="sub"
              color={on ? 'ink' : 'muted'}
              style={{ fontWeight: on ? '700' : '400' }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
