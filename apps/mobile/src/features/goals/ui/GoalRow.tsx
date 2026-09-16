import type { GoalDefinition, GoalProgress } from '@jinx/core';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { ShareButton } from '@/features/share/ShareButton';
import { useTheme } from '@/theme/ThemeProvider';
import { progressLabel, progressRatio } from '../builder';
import { ProgressBar } from './ProgressBar';

type Props = {
  title: string;
  definition: GoalDefinition | null;
  progress: GoalProgress | null;
  /** Overrides the computed label ("21 of 30"). */
  label?: string;
  last?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Shown as a share icon when the goal is done. */
  onShare?: () => void;
};

/** Title, "3 of 5", and a progress bar; completed goals turn green and read "Done". */
export function GoalRow({
  title,
  definition,
  progress,
  label,
  last,
  onPress,
  onLongPress,
  onShare,
}: Props) {
  const theme = useTheme();
  const done = !!progress?.completed;
  const text =
    label ?? (progress && definition ? progressLabel(progress, definition) : 'Not evaluated');
  const body = (
    <View style={{ marginBottom: last ? 0 : theme.spacing.sm + 2 }}>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}
      >
        <Text
          variant="body"
          style={{ flex: 1, fontWeight: done ? '700' : '400' }}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text
          variant="sub"
          color={done ? 'green' : 'muted'}
          style={{ fontWeight: done ? '700' : '400' }}
        >
          {text}
        </Text>
        {done && onShare ? (
          <ShareButton label={`Share ${title}`} size={28} onPress={onShare} />
        ) : null}
      </View>
      <ProgressBar ratio={progress ? progressRatio(progress) : 0} done={done} />
    </View>
  );
  if (!onPress && !onLongPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${text}`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {body}
    </Pressable>
  );
}
