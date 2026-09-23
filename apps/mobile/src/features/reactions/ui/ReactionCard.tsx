import { lateLabel } from '@jinx/core';
import React from 'react';
import { Image, Pressable, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

import type { GameReaction } from '../queries';

/**
 * The stitched result: the field photo with the selfie inset, BeReal-style (03, section 4).
 * The two photos are stored apart and composed here, so a reaction is never a third file.
 */
export function StitchedPhoto({
  backUrl,
  frontUrl,
  size,
  style,
}: {
  backUrl: string | null;
  frontUrl: string | null;
  /** Width; the card is 4:5. */
  size: number;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const height = Math.round(size * 1.25);
  const inset = Math.round(size * 0.3);
  return (
    <View style={[{ width: size, height, borderRadius: theme.radius.lg, overflow: 'hidden', backgroundColor: theme.colors.card }, style]}>
      {backUrl ? <Image source={{ uri: backUrl }} style={{ width: size, height }} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
      <View
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          width: inset,
          height: Math.round(inset * 1.33),
          borderRadius: theme.radius.md,
          overflow: 'hidden',
          backgroundColor: theme.colors.screen,
          borderWidth: 2,
          borderColor: theme.colors.screen,
        }}
      >
        {frontUrl ? <Image source={{ uri: frontUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
      </View>
    </View>
  );
}

/** "Maya · Bottom 8th · late by 4 min" under a stitched photo. */
export function reactionCaption(r: Pick<GameReaction, 'display_name' | 'handle' | 'period_label' | 'late_seconds' | 'mine' | 'label'>): string {
  const who = r.mine ? 'You' : r.display_name?.trim() || `@${r.handle}`;
  const parts = [who, r.period_label, lateLabel(r.late_seconds)].filter((x): x is string => !!x);
  return parts.join(' · ');
}

export function ReactionCard({ reaction, size, onPress }: { reaction: GameReaction; size: number; onPress?: () => void }) {
  const theme = useTheme();
  const body = (
    <View style={{ width: size }}>
      <StitchedPhoto backUrl={reaction.backUrl} frontUrl={reaction.frontUrl} size={size} />
      <Text variant="caption" color="muted" numberOfLines={1} style={{ marginTop: 4 }}>
        {reactionCaption(reaction)}
      </Text>
      {reaction.label ? (
        <Text variant="caption" numberOfLines={2} style={{ color: theme.colors.ink }}>
          {reaction.label}
        </Text>
      ) : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Reaction, ${reactionCaption(reaction)}`} onPress={onPress}>
      {body}
    </Pressable>
  );
}
