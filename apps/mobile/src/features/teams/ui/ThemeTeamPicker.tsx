import React from 'react';
import { Pressable, View } from 'react-native';

import { IconCheckC } from '@/components/reference/icons';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { shortTeamName } from '@/features/data/names';
import { useTheme } from '@/theme/ThemeProvider';
import { TeamTheme } from '@/theme/reference/TeamTheme';

import type { Team } from '../queries';
import { resolveThemeTeamId, useSetThemeTeam, useStoredThemeTeamId } from '../themeStore';

type SwatchProps = {
  team: Team;
  selected: boolean;
  onPress: () => void;
};

/** One team, in its own colours: solid with a check when it is the one worn, washed when not. */
function Swatch({ team, selected, onPress }: SwatchProps) {
  const theme = useTheme();
  const a = theme.accent;
  const ink = selected ? a.onFill : a.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Use ${team.name} colors`}
      testID={`theme-team-${team.id}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 44,
        paddingVertical: 10,
        paddingLeft: 12,
        paddingRight: 16,
        borderRadius: theme.radius.pill,
        backgroundColor: selected ? a.fill : a.wash,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {selected ? (
        <IconCheckC size={18} color={ink} />
      ) : (
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: a.fill }} />
      )}
      <Text variant="label" weight={750} numberOfLines={1} style={{ color: ink }}>
        {shortTeamName(team.name, team)}
      </Text>
    </Pressable>
  );
}

/**
 * Settings > Favorites > Teams: which favourite team the whole app wears.
 *
 * With one favourite there is nothing to choose, so it draws nothing. The marked team is the one
 * `AccentRoot` resolves, so a stored pick that is no longer a favourite shows the first team as
 * chosen, which is what the app is wearing.
 */
export function ThemeTeamPicker({ teams }: { teams: readonly Team[] }) {
  const theme = useTheme();
  const stored = useStoredThemeTeamId();
  const setThemeTeam = useSetThemeTeam();
  if (teams.length < 2) return null;
  const current = resolveThemeTeamId(stored, teams);
  return (
    <View style={{ marginBottom: theme.spacing.sm }}>
      <SectionHeader title="App color" />
      <Text variant="caption" color="muted" style={{ marginBottom: 12 }}>
        Jinx wears this team&apos;s colors. Game pages always use the teams playing.
      </Text>
      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
      >
        {teams.map((t) => (
          <TeamTheme key={t.id} team={t.id}>
            <Swatch team={t} selected={t.id === current} onPress={() => setThemeTeam(t.id)} />
          </TeamTheme>
        ))}
      </View>
    </View>
  );
}
