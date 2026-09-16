import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useTeams, type Team, teamLabel } from '@/features/teams/queries';
import { sportLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from './Card';
import { CheckRow } from './CheckRow';
import { Chip } from './Chip';
import { ErrorNotice } from './ErrorNotice';
import { Loading } from './Loading';
import { Text } from './Text';
import { TextField } from './TextField';

type Props = {
  selected: Team[];
  onChange: (teams: Team[]) => void;
};

/** Searchable multi-select over active teams, grouped by sport. Plain names only, never logos. */
export function TeamPicker({ selected, onChange }: Props) {
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
            <Chip key={t.id} label={teamLabel(t)} selected onPress={() => toggle(t)} />
          ))}
        </View>
      ) : null}
      {teams.isPending ? <Loading /> : null}
      {teams.isError ? (
        <ErrorNotice error={teams.error} message="Could not load teams." onRetry={teams.refetch} />
      ) : null}
      {groups.map(([sport, list]) => (
        <Card key={sport} label={sportLabel(sport)}>
          {list.map((t, i) => (
            <CheckRow
              key={t.id}
              title={teamLabel(t)}
              checked={selectedIds.has(t.id)}
              onToggle={() => toggle(t)}
              first={i === 0}
            />
          ))}
        </Card>
      ))}
      {!teams.isPending && groups.length === 0 ? (
        <Text color="muted" variant="sub">
          No teams match “{query.trim()}”.
        </Text>
      ) : null}
    </View>
  );
}
