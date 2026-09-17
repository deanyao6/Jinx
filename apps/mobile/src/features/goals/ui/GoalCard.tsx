import type { GoalDefinition, GoalProgress } from '@jinx/core';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { IconCheckC, IconShare } from '@/components/reference/icons';
import { Text } from '@/components/Text';
import { alpha } from '@/theme/color';
import { useTheme } from '@/theme/ThemeProvider';
import { progressLabel, progressRatio } from '../builder';

type CountProps = {
  /** "7 of 20", "+1.2 of +0.5", "Not yet" or "Done", as the builders word it. */
  label: string;
  done?: boolean;
  /** The hero size, for the top of a detail page. */
  big?: boolean;
};

/**
 * Progress as a condensed number: the count in the team colour with a small "of 20" after it.
 * A label with no number in it ("Not yet") is set as a kicker, and a finished one is a green
 * check.
 */
export function ProgressCount({ label, done = false, big = false }: CountProps) {
  const theme = useTheme();
  const parts = /^(.+) of (.+)$/.exec(label);
  if (parts) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: big ? 8 : 5 }}>
        {done ? (
          <View style={{ alignSelf: 'center' }}>
            <IconCheckC size={big ? 30 : 18} color={theme.colors.green} />
          </View>
        ) : null}
        <Text
          variant={big ? 'display' : 'stat'}
          color={done ? 'green' : 'accent'}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {parts[1]}
        </Text>
        <Text variant={big ? 'body' : 'sub'} color="muted" weight={600}>
          of {parts[2]}
        </Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {done ? <IconCheckC size={big ? 26 : 18} color={theme.colors.green} /> : null}
      <Text variant={big ? 'h2' : 'kicker'} color={done ? 'green' : 'muted'}>
        {label}
      </Text>
    </View>
  );
}

type Props = {
  title: string;
  /** One quiet line under the title. */
  subtitle?: string | null;
  definition: GoalDefinition | null;
  progress: GoalProgress | null;
  /** Overrides the computed label ("21 of 30"). */
  label?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Shown as a share mark when the goal is done. */
  onShare?: () => void;
  /** Sits under the bar: a row of seals on a bucket list. */
  children?: React.ReactNode;
};

/**
 * One goal, or one joined bucket list, as a card of its own: the title, the count as a condensed
 * number in the team colour, and the bar. Finished turns the bar and the mark green.
 */
export function GoalCard({
  title,
  subtitle,
  definition,
  progress,
  label,
  onPress,
  onLongPress,
  onShare,
  children,
}: Props) {
  const theme = useTheme();
  const done = !!progress?.completed;
  const text =
    label ?? (progress && definition ? progressLabel(progress, definition) : 'Not evaluated');
  const card = (
    <Card style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" color="muted" numberOfLines={2} style={{ marginTop: 1 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <ProgressCount label={text} done={done} />
        {done && onShare ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Share ${title}`}
            onPress={onShare}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: alpha(theme.colors.green, 0.14),
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <IconShare size={17} color={theme.colors.green} />
          </Pressable>
        ) : null}
      </View>
      <ProgressBar value={progress ? progressRatio(progress) : 0} done={done} />
      {children}
    </Card>
  );
  if (!onPress && !onLongPress) return card;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${text}`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {card}
    </Pressable>
  );
}
