import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackHeader } from '@/components/reference/BackHeader';
import { Card, EmptyNote, Row, SearchField, SectionLabel } from '@/features/favorites/ui';
import { screen } from '@/features/favorites/screen';
import { useFavoriteTeams, useSetFavoriteTeams } from '@/features/profile/queries';
import { useTeams, type Team } from '@/features/teams/queries';
import { sportLabel } from '@/lib/format';
import { ReferenceThemeProvider, useReferenceTheme } from '@/theme/reference/TeamTheme';

/**
 * Step two of the team picker: choose a team in one league, and that is the whole flow.
 *
 * Tapping toggles immediately rather than collecting a selection behind a Save button.
 * There is nothing else on the screen to save, and the favourites list you came from
 * updates under you, so a Save would only be a way to lose the change by leaving.
 */
function TeamsBody() {
  const { base } = useReferenceTheme();
  const { sport } = useLocalSearchParams<{ sport?: string }>();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = React.useState('');

  const teams = useTeams(true);
  const favorites = useFavoriteTeams();
  const setFavorites = useSetFavoriteTeams();

  const favoriteList = React.useMemo(() => favorites.data ?? [], [favorites.data]);
  const favoriteIds = React.useMemo(() => new Set(favoriteList.map((t) => t.id)), [favoriteList]);

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

  const toggle = (team: Team) => {
    if (favoriteIds.has(team.id)) {
      setFavorites.mutate(favoriteList.filter((t) => t.id !== team.id));
    } else {
      setFavorites.mutate([...favoriteList, team]);
    }
  };

  return (
    <View style={[screen.root, { paddingTop: insets.top, backgroundColor: base.scr }]}>
      <BackHeader
        title={sport ? sportLabel(sport) : 'Teams'}
        fallback="/settings/favorites/league?mode=teams"
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
            {list.map((t) => {
              const on = favoriteIds.has(t.id);
              return (
                <Row
                  key={t.id}
                  title={t.name}
                  meta={t.city}
                  checked={on}
                  accessibilityLabel={`${t.name}, ${on ? 'remove from' : 'add to'} favorites`}
                  onPress={() => toggle(t)}
                />
              );
            })}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

export default function TeamsRoute() {
  return (
    <ReferenceThemeProvider team="none">
      <TeamsBody />
    </ReferenceThemeProvider>
  );
}
