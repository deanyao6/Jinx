import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ICONS, type IconName } from '@/components/reference/icons';
import { Text } from '@/components/Text';
import { alpha } from '@/theme/color';
import { useTheme } from '@/theme/ThemeProvider';

export type ResultTone = 'win' | 'loss' | 'neutral';

/** A small filled pill for how something came out: green for a win, red for a loss, muted otherwise. */
export function ResultPill({ label, tone }: { label: string; tone: ResultTone }) {
  const theme = useTheme();
  const c = theme.colors;
  const color = tone === 'win' ? c.green : tone === 'loss' ? c.red : c.muted;
  const background =
    tone === 'win'
      ? alpha(c.green, 0.16)
      : tone === 'loss'
        ? alpha(c.red, 0.14)
        : alpha(c.ink, theme.scheme === 'dark' ? 0.12 : 0.07);
  return (
    <View
      style={{
        backgroundColor: background,
        borderRadius: theme.radius.pill,
        paddingVertical: 4,
        paddingHorizontal: 10,
      }}
    >
      <Text variant="kicker" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

/** One line of a compact card: a small icon and a sentence. `good` draws both in green. */
export function Fact({
  icon,
  children,
  tone = 'ink',
}: {
  icon: IconName;
  children: React.ReactNode;
  tone?: 'ink' | 'muted' | 'good';
}) {
  const theme = useTheme();
  const Icon = ICONS[icon];
  const iconColor =
    tone === 'good'
      ? theme.colors.green
      : tone === 'muted'
        ? theme.colors.muted
        : theme.accent.text;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
      <View style={{ marginTop: 2 }}>
        <Icon size={15} color={iconColor} />
      </View>
      <Text
        variant="sub"
        color={tone === 'good' ? 'green' : tone === 'muted' ? 'muted' : 'ink'}
        weight={tone === 'good' ? 700 : undefined}
        style={{ flex: 1 }}
      >
        {children}
      </Text>
    </View>
  );
}

/**
 * A destructive action that stays out of the way: red text and nothing else. For the action a
 * card has to offer and nobody should reach for, where the washed `danger` button is too loud.
 */
export function QuietDangerButton({
  title,
  onPress,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: loading }}
      disabled={loading}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        minHeight: 36,
        paddingHorizontal: theme.spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: loading ? 0.45 : pressed ? 0.6 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.red} />
      ) : (
        <Text variant="sub" weight={700} color="red">
          {title}
        </Text>
      )}
    </Pressable>
  );
}
