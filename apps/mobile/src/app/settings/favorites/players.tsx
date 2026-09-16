import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackHeader } from '@/components/reference/BackHeader';
import { Card, EmptyNote, Row, SearchField, SectionLabel } from '@/features/favorites/ui';
import { screen } from '@/features/favorites/screen';
import { useTeams } from '@/features/teams/queries';
import { sportLabel } from '@/lib/format';
import { ReferenceThemeProvider, useReferenceTheme } from '@/theme/reference/TeamTheme';

/**
 * Step two of the player picker: choose a team, which is the way into its roster.
 *
 * Nothing is favourited here. The rows carry a chevron rather than a checkmark so the
 * screen cannot be mistaken for the team picker, which looks the same and does something
 * else entirely.
 */
function PlayerTeamsBody() {
  const { base } = useReferenceTheme();
  const { sport } = useLocalSearchParams<{ sport?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    <View style={[screen.root, { paddingTop: insets.top, backgroundColor: base.scr }]}>
      <BackHeader
        title={sport ? sportLabel(sport) : 'Teams'}
        fallback="/settings/favorites/league?mode=players"
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <SearchField value={query} onChangeText={setQuery} placeholder="Search teams" />
        <SectionLabel>Choose a team</SectionLabel>
        {teams.isPending ? (
          <EmptyNote>Loading teams…</EmptyNote>
        ) : list.length === 0 ? (
          <EmptyNote>
            {query.trim() ? `No teams match "${query.trim()}".` : 'No teams in this league yet.'}
          </EmptyNote>
        ) : (
          <Card>
            {list.map((t) => (
              <Row
                key={t.id}
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
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

export default function PlayerTeamsRoute() {
  return (
    <ReferenceThemeProvider team="none">
      <PlayerTeamsBody />
    </ReferenceThemeProvider>
  );
}
