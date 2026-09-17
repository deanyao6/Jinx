import React from 'react';
import { TextInput, type TextInputProps, View, type ViewStyle } from 'react-native';

import { fontFamily } from '@/theme/fonts';
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
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={[{ marginBottom: theme.spacing.md }, containerStyle]}>
      {label ? (
        <Text variant="kicker" color="muted" style={{ marginBottom: 7 }}>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: c.card,
          // No outline at rest. The ring only appears to say something: focus, or an error.
          borderColor: error ? c.red : focused ? theme.accent.text : 'transparent',
          borderWidth: 1.5,
          borderRadius: theme.radius.lg - 2,
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
          selectionColor={theme.accent.text}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          style={[
            {
              flex: 1,
              color: c.ink,
              fontSize: theme.type.body.fontSize,
              paddingVertical: theme.spacing.md,
              minHeight: 48,
              fontFamily: fontFamily(),
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
