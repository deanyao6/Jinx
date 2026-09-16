import React from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { overlapSentence } from '../copy';
import type { Overlap } from '../queries';

type Props = { overlap: Overlap; onOpenGame: () => void; onOpenProfile: () => void };

export function OverlapCard({ overlap: o, onOpenGame, onOpenProfile }: Props) {
  const theme = useTheme();
  const who = o.other_display_name?.trim() || `@${o.other_handle}`;
  return (
    <Card label={o.before_connected ? 'Before you connected' : 'Same game'}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open game"
        onPress={onOpenGame}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Text variant="body">{overlapSentence(o)}</Text>
        {o.venue_name ? (
          <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
            {o.venue_name}
          </Text>
        ) : null}
      </Pressable>
      <View style={{ flexDirection: 'row', marginTop: theme.spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenProfile}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text variant="caption" color="blue">
            {who}’s passport
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}
