import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { pctLabel, underdogTeamId } from './lock';

export type PledgeSide = { team_id: string; name: string; win_prob: number | null };

type Props = {
  away: PledgeSide;
  home: PledgeSide;
  selectedTeamId: string | null;
  disabled?: boolean;
  onPick: (teamId: string) => void;
};

/** Two stacked team buttons with win probability and the underdog label (mockup screen 2). */
export function PledgeSides({ away, home, selectedTeamId, disabled = false, onPick }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const underdog = underdogTeamId(home, away);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Choose a team"
      style={{ gap: theme.spacing.sm + 2, marginVertical: theme.spacing.md }}
    >
      {[away, home].map((t) => {
        const on = selectedTeamId === t.team_id;
        const dog = underdog === t.team_id;
        const tag = underdog == null ? null : dog ? 'Underdog' : 'Favorite';
        return (
          <Pressable
            key={t.team_id}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled }}
            accessibilityLabel={`${t.name}, ${pctLabel(t.win_prob)} to win${tag ? `, ${tag.toLowerCase()}` : ''}`}
            disabled={disabled}
            onPress={() => onPick(t.team_id)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderWidth: 2,
              borderColor: on ? c.ink : c.line,
              backgroundColor: on ? c.ink : c.card,
              borderRadius: theme.radius.lg,
              paddingVertical: 14,
              paddingHorizontal: 16,
              opacity: disabled ? 0.55 : pressed ? 0.8 : 1,
            })}
          >
            <Text variant="stat" color={on ? 'onInk' : 'ink'} style={{ flex: 1 }} numberOfLines={2}>
              {t.name}
            </Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text
                variant="h2"
                color={on ? 'onInk' : 'ink'}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {pctLabel(t.win_prob)}
              </Text>
              {tag ? (
                <Text
                  variant="caption"
                  color={on ? 'onInk' : dog ? 'gold' : 'muted'}
                  style={{ fontWeight: dog ? '700' : '400' }}
                >
                  {tag}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
