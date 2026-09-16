import React from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { gamesLabel, rivalLabel } from '../copy';

export type RivalryCardData = {
  rival_handle: string;
  rival_display_name: string | null;
  rival_teams: string[];
  my_wins: number;
  rival_wins: number;
  ties: number;
  together_my_wins: number;
  together_rival_wins: number;
  my_meetings_attended: number;
  rival_meetings_attended: number;
};

type Props = { rivalry: RivalryCardData; onOpen?: () => void };

/** "Rivalry with Jordan, Cowboys fan" card: head-to-head, together vs apart, meetings context. */
export function RivalryCard({ rivalry: r, onOpen }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const name = r.rival_display_name?.trim() || `@${r.rival_handle}`;
  const first = name.split(' ')[0] || name;
  const apartMine = r.my_wins - r.together_my_wins;
  const apartTheirs = r.rival_wins - r.together_rival_wins;
  const total = r.my_wins + r.rival_wins + r.ties;
  const leadColor = r.my_wins > r.rival_wins ? 'green' : r.rival_wins > r.my_wins ? 'red' : 'ink';

  const body = (
    <Card label={`Rivalry with ${rivalLabel(name, r.rival_teams)}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center', minWidth: 72 }}>
          <Text
            variant="display"
            color={leadColor}
            style={{ fontSize: 46, lineHeight: 48 }}
            accessibilityLabel={`You ${r.my_wins}`}
          >
            {r.my_wins}
          </Text>
          <Text variant="caption" color="muted">
            You
          </Text>
        </View>
        <Text variant="caption" color="muted" align="center" style={{ flex: 1 }}>
          {total === 0
            ? 'No head-to-head games yet'
            : `Head to head${r.ties ? `, ${gamesLabel(r.ties)} tied` : ''}`}
        </Text>
        <View style={{ alignItems: 'center', minWidth: 72 }}>
          <Text
            variant="display"
            color={leadColor === 'ink' ? 'ink' : leadColor === 'green' ? 'red' : 'green'}
            style={{ fontSize: 46, lineHeight: 48 }}
            accessibilityLabel={`${first} ${r.rival_wins}`}
          >
            {r.rival_wins}
          </Text>
          <Text variant="caption" color="muted" numberOfLines={1}>
            {first}
          </Text>
        </View>
      </View>
      {total > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            marginTop: theme.spacing.md,
            paddingTop: theme.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: c.line,
            gap: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="muted">
              Together
            </Text>
            <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
              {r.together_my_wins}–{r.together_rival_wins}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="muted">
              Apart
            </Text>
            <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
              {apartMine}–{apartTheirs}
            </Text>
          </View>
        </View>
      ) : null}
      <Text variant="caption" color="muted" style={{ marginTop: theme.spacing.sm }}>
        Your teams’ meetings: you attended {gamesLabel(r.my_meetings_attended)}, {first} attended{' '}
        {gamesLabel(r.rival_meetings_attended)}.
      </Text>
    </Card>
  );
  if (!onOpen) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rivalry with ${name}`}
      onPress={onOpen}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {body}
    </Pressable>
  );
}
