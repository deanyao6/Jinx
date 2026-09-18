import React from 'react';
import { Pressable, View } from 'react-native';

import { IconCheckC, IconPlus } from '@/components/reference/icons';
import { Text } from '@/components/Text';
import { rosterMark, seenLine } from '@/features/favorites/meta';
import type { RosterPlayer } from '@/features/players/queries';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  player: RosterPlayer;
  selected: boolean;
  onToggle: () => void;
};

/**
 * One player of a roster, compact enough that a 53-man NFL roster is a scroll and not a
 * trek: the name, the position (or "Former", for someone you saw who has since left) as a
 * small muted mark beside it, "Seen N times" in the team colour underneath when there is
 * something to say, and a check once picked. Reads the team in scope, so wrap the list in
 * `<TeamTheme>`.
 */
export function RosterRow({ player, selected, onToggle }: Props) {
  const theme = useTheme();
  const a = theme.accent;
  const mark = rosterMark(player);
  const seen = seenLine(player);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${player.full_name}, ${selected ? 'remove from' : 'add to'} favorites`}
      onPress={onToggle}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minHeight: 46,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: theme.spacing.sm,
        borderRadius: theme.radius.md,
        backgroundColor: selected ? a.wash : theme.colors.card,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
            {player.full_name}
          </Text>
          {mark ? (
            <Text variant="caption" color="muted">
              {mark}
            </Text>
          ) : null}
        </View>
        {seen ? (
          <Text variant="caption" color="accent" weight={750} style={{ marginTop: 1 }}>
            {seen}
          </Text>
        ) : null}
      </View>
      {selected ? (
        <IconCheckC size={20} color={a.text} />
      ) : (
        <IconPlus size={18} color={theme.colors.muted} />
      )}
    </Pressable>
  );
}
