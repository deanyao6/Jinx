import React from 'react';
import { ActivityIndicator, Pressable, type PressableProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  style?: ViewStyle;
  small?: boolean;
};

export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  small = false,
  ...rest
}: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const isDisabled = disabled || loading;
  const background =
    variant === 'primary' ? c.ink : variant === 'secondary' ? c.tint : 'transparent';
  const border = variant === 'ghost' || variant === 'danger' ? c.line : background;
  const textColor: 'onInk' | 'ink' | 'red' =
    variant === 'primary' ? 'onInk' : variant === 'danger' ? 'red' : 'ink';
  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: background,
          borderColor: border,
          borderWidth: 1,
          borderRadius: theme.radius.md,
          paddingVertical: small ? theme.spacing.sm : theme.spacing.md + 2,
          paddingHorizontal: theme.spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
          minHeight: small ? 36 : 48,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? c.onInk : c.ink} />
      ) : (
        <Text variant="bodyStrong" color={textColor}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
