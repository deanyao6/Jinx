import React from 'react';
import { TextInput, type TextInputProps, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string | null;
  containerStyle?: ViewStyle;
  prefix?: string;
};

export function TextField({ label, error, hint, containerStyle, prefix, style, ...rest }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={[{ marginBottom: theme.spacing.md }, containerStyle]}>
      {label ? (
        <Text variant="label" color="muted" style={{ marginBottom: 6, textTransform: 'uppercase' }}>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: c.card,
          borderColor: error ? c.red : c.line,
          borderWidth: 1,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.md,
        }}
      >
        {prefix ? (
          <Text color="muted" style={{ marginRight: 2 }}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          placeholderTextColor={c.muted}
          {...rest}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          style={[
            {
              flex: 1,
              color: c.ink,
              fontSize: theme.type.body.fontSize,
              paddingVertical: theme.spacing.md,
              minHeight: 46,
            },
            style,
          ]}
        />
      </View>
      {error ? (
        <Text variant="caption" color="red" style={{ marginTop: 4 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="muted" style={{ marginTop: 4 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
