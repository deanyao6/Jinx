import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { SectionHeader } from '@/components/SectionHeader';
import { TextField } from '@/components/TextField';
import { PickRow } from '@/features/account/ui/PickRow';
import { SettingsFrame } from '@/features/account/ui/SettingsFrame';
import { useTeams } from '@/features/teams/queries';
import { sportLabel } from '@/lib/format';
import { TeamTheme } from '@/theme/reference/TeamTheme';

/**
 * Step two of the player picker: choose a team, which is the way into its roster.
 *
 * Nothing is favourited here. The rows carry a chevron rather than a checkmark so the
 * screen cannot be mistaken for the team picker, which looks the same and does something
 * else entirely. Each row's tile is that team's colour.
 */
export default function PlayerTeamsRoute() {
  const { sport } = useLocalSearchParams<{ sport?: string }>();
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const teams = useTeams(true);

  const list = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return (teams.data ?? [])
      .filter((t) => t.sport_id === sport)
      .filter(
        (t) =>
          !q ||
          t.name.toLowerCase().includes(q) ||
          t.city.toLowerCase().includes(q) ||
          t.abbreviation.toLowerCase() === q,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teams.data, sport, query]);

  return (
    <SettingsFrame
      title={sport ? sportLabel(sport) : 'Teams'}
      fallback="/settings/favorites/league?mode=players"
    >
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search teams"
        accessibilityLabel="Search teams"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <SectionHeader title="Choose a team" />
      {teams.isPending ? (
        <Loading label="Loading teams…" />
      ) : list.length === 0 ? (
        <EmptyState
          icon="i-search"
          title="No teams"
          body={query.trim() ? `No teams match "${query.trim()}".` : 'No teams in this league yet.'}
        />
      ) : (
        list.map((t) => (
          <TeamTheme key={t.id} team={t.id}>
            <PickRow
              badge={t.abbreviation}
              title={t.name}
              meta={t.city}
              chevron
              accessibilityLabel={`${t.name}, see players`}
              onPress={() =>
                router.push(
                  `/settings/favorites/roster?teamId=${t.id}&name=${encodeURIComponent(t.name)}&sport=${t.sport_id}`,
                )
              }
            />
          </TeamTheme>
        ))
      )}
    </SettingsFrame>
  );
}
