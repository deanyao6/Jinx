import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { superlativeLabel, type SuperlativeRow } from '../format';

type Props = {
  rows: SuperlativeRow[];
  limit?: number;
  /** Optional second line per row (e.g. the linked game's matchup). */
  subtitleFor?: (row: SuperlativeRow) => string | null;
  onPressRow?: (row: SuperlativeRow) => void;
};

/** "Seen Bryce Harper play · 14 times" rows with hairline dividers, as on mockup screen 1. Pure. */
export function SuperlativesList({ rows, limit, subtitleFor, onPressRow }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <View>
      {shown.map((row, i) => {
        // The stadium a row is about lives in its context now, not its title.
        const subtitle = subtitleFor?.(row) ?? row.context ?? null;
        const pressable = !!onPressRow && !!(row.gameId || row.venueId || row.playerId);
        const body = (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              paddingVertical: 8,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: c.line,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text variant="body">{superlativeLabel(row)}</Text>
              {subtitle ? (
                <Text variant="caption" color="muted" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Text variant="bodyStrong" style={{ fontSize: 16 }}>
              {row.value}
            </Text>
            {pressable ? <Ionicons name="chevron-forward" size={14} color={c.muted} /> : null}
          </View>
        );
        if (!pressable) return <View key={row.key}>{body}</View>;
        return (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            onPress={() => onPressRow?.(row)}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            {body}
          </Pressable>
        );
      })}
    </View>
  );
}
