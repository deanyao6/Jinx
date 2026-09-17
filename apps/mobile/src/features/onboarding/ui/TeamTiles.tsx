import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { IconCheckC } from '@/components/reference/icons';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useTeams, type Team, teamLabel } from '@/features/teams/queries';
import { sportLabel } from '@/lib/format';
import { TeamTheme } from '@/theme/reference/TeamTheme';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  selected: Team[];
  onChange: (teams: Team[]) => void;
};

/**
 * The onboarding team picker: the same search, grouping and multi-select as the shared
 * `TeamPicker`, drawn as tiles so this is the screen where colour arrives. Every tile sits
 * inside its own `TeamTheme`, washed in that team's colour until it is picked and filled with
 * it afterwards. Plain names only, never logos.
 */
export function TeamTiles({ selected, onChange }: Props) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const teams = useTeams(true);

  const selectedIds = useMemo(() => new Set(selected.map((t) => t.id)), [selected]);
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (teams.data ?? []).filter(
      (t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        t.abbreviation.toLowerCase() === q,
    );
    const bySport = new Map<string, Team[]>();
    for (const t of list) {
      const arr = bySport.get(t.sport_id) ?? [];
      arr.push(t);
      bySport.set(t.sport_id, arr);
    }
    return [...bySport.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [teams.data, query]);

  const toggle = (team: Team) => {
    if (selectedIds.has(team.id)) onChange(selected.filter((t) => t.id !== team.id));
    else onChange([...selected, team]);
  };

  return (
    <View>
      <TextField
        placeholder="Search teams"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        accessibilityLabel="Search teams"
      />
      {selected.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.sm }}>
          {selected.map((t) => (
            <TeamTheme key={t.id} team={t.id}>
              <Chip label={teamLabel(t)} selected onPress={() => toggle(t)} />
            </TeamTheme>
          ))}
        </View>
      ) : null}
      {teams.isPending ? <Loading /> : null}
      {teams.isError ? (
        <ErrorNotice error={teams.error} message="Could not load teams." onRetry={teams.refetch} />
      ) : null}
      {groups.map(([sport, list]) => (
        <View key={sport} style={{ marginBottom: theme.spacing.xl }}>
          <SectionHeader title={sportLabel(sport)} />
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              rowGap: 10,
            }}
          >
            {list.map((t) => (
              <TeamTheme key={t.id} team={t.id}>
                <TeamTile team={t} checked={selectedIds.has(t.id)} onToggle={() => toggle(t)} />
              </TeamTheme>
            ))}
          </View>
        </View>
      ))}
      {!teams.isPending && groups.length === 0 ? (
        <Text color="muted" variant="sub">
          No teams match “{query.trim()}”.
        </Text>
      ) : null}
    </View>
  );
}

/** One team, in its own colours. Reads the accent of the `TeamTheme` it is rendered inside. */
function TeamTile({
  team,
  checked,
  onToggle,
}: {
  team: Team;
  checked: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const a = theme.accent;
  const name = checked ? a.onFill : theme.colors.ink;
  const mark = checked ? a.onFill : a.text;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={teamLabel(team)}
      onPress={onToggle}
      style={({ pressed }) => ({
        // Two to a row; the row spreads them, so the gap between is what is left over.
        width: '48.5%',
        minHeight: 78,
        borderRadius: theme.radius.lg,
        backgroundColor: checked ? a.fill : a.wash,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md + 2,
        justifyContent: 'space-between',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="kicker" style={{ color: mark }}>
          {team.abbreviation}
        </Text>
        {checked ? (
          <IconCheckC size={16} color={a.onFill} />
        ) : (
          // The team's two colours as a pair of dots, where a logo would otherwise go.
          <View style={{ flexDirection: 'row', gap: 3 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: a.text }} />
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: a.second }} />
          </View>
        )}
      </View>
      <View>
        <Text variant="h2" numberOfLines={1} adjustsFontSizeToFit style={{ color: name }}>
          {team.nickname ?? team.name}
        </Text>
        <Text
          variant="caption"
          numberOfLines={1}
          style={{ color: name, opacity: checked ? 0.8 : 0.62 }}
        >
          {team.city}
        </Text>
      </View>
    </Pressable>
  );
}
