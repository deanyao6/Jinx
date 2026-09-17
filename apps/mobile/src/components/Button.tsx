import React from 'react';
import { ActivityIndicator, Pressable, type PressableProps, type ViewStyle } from 'react-native';

import { alpha } from '@/theme/color';
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

/**
 * `primary` is the team colour, solid: one per screen. `secondary` is the same colour washed
 * out, which still reads as a button on a dark card where a grey fill did not. `ghost` is the
 * colour as text alone. None of them has an outline.
 */
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
  const a = theme.accent;
  const isDisabled = disabled || loading;
  const background =
    variant === 'primary'
      ? a.fill
      : variant === 'secondary'
        ? a.themed
          ? a.wash
          : alpha(c.ink, theme.scheme === 'dark' ? 0.12 : 0.07)
        : variant === 'danger'
          ? alpha(c.red, 0.12)
          : 'transparent';
  const textColor = variant === 'primary' ? a.onFill : variant === 'danger' ? c.red : a.text;
  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: background,
          borderRadius: theme.radius.lg - 2,
          paddingVertical: small ? theme.spacing.sm : theme.spacing.md + 2,
          paddingHorizontal: small ? theme.spacing.md + 2 : theme.spacing.lg + 2,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isDisabled ? 0.45 : pressed ? 0.8 : 1,
          minHeight: small ? 36 : 50,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text variant={small ? 'sub' : 'bodyStrong'} weight={750} style={{ color: textColor }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
