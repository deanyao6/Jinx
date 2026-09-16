import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { momentRows } from '../format';
import type { StatsMoment } from '../types';

type Props = {
  moments: StatsMoment[];
  limit?: number;
  onPress?: (type: string) => void;
};

/** Horizontal row of moment tiles: big count over a friendly label. Pure. */
export function MomentsRow({ moments, limit, onPress }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const rows = momentRows(moments);
  const shown = limit ? rows.slice(0, limit) : rows;
  if (shown.length === 0) {
    return (
      <Text variant="sub" color="muted">
        Walk-offs, grand slams, overtime and more show up here after the games you attend go final.
      </Text>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: theme.spacing.sm }}
    >
      {shown.map((m) => (
        <Pressable
          key={m.type}
          accessibilityRole="button"
          accessibilityLabel={`${m.label}, ${m.count}`}
          onPress={onPress ? () => onPress(m.type) : undefined}
          disabled={!onPress}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <View
            style={{
              backgroundColor: c.tint,
              borderRadius: theme.radius.md,
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              minWidth: 96,
            }}
          >
            <Text variant="stat" style={{ fontVariant: ['tabular-nums'] }}>
              {m.count}
            </Text>
            <Text variant="caption" color="muted" numberOfLines={2} style={{ maxWidth: 120 }}>
              {m.label}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
