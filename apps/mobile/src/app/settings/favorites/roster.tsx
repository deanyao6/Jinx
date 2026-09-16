import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackHeader } from '@/components/reference/BackHeader';
import { Card, EmptyNote, Row, SearchField, SectionLabel } from '@/features/favorites/ui';
import { screen } from '@/features/favorites/screen';
import { rosterMeta } from '@/features/favorites/meta';
import {
  useFavoritePlayers,
  useTeamRoster,
  useToggleFavoritePlayer,
} from '@/features/players/queries';
import { ReferenceThemeProvider, useReferenceTheme } from '@/theme/reference/TeamTheme';

/**
 * Step three of the player picker: choose a player.
 *
 * The list is everyone who has ever appeared for this team, most appearances first, which
 * is as close to "the players you would recognise" as this database can honestly get. See
 * the `team_roster` migration for why it is derived from appearances rather than stored.
 *
 * The search goes to the database rather than filtering what arrived, because the roster is
 * capped at 200 rows and a long-serving franchise has more players than that. Typing a name
 * that is not in the first 200 still finds them.
 */
function RosterBody() {
  const { base } = useReferenceTheme();
  const { teamId, name, sport } = useLocalSearchParams<{
    teamId?: string;
    name?: string;
    sport?: string;
  }>();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  // The roster query hits an RPC, so it waits for a pause in typing rather than firing per
  // keystroke.
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(id);
  }, [query]);

  const roster = useTeamRoster(teamId, debounced);
  const favorites = useFavoritePlayers();
  const toggle = useToggleFavoritePlayer();

  const favoriteIds = React.useMemo(
    () => new Set((favorites.data ?? []).map((p) => p.id)),
    [favorites.data],
  );

  const list = roster.data ?? [];

  return (
    <View style={[screen.root, { paddingTop: insets.top, backgroundColor: base.scr }]}>
      <BackHeader
        title={name ?? 'Players'}
        fallback={`/settings/favorites/players?sport=${sport ?? 'mlb'}`}
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <SearchField value={query} onChangeText={setQuery} placeholder="Search players" />
        <SectionLabel>Choose a player</SectionLabel>
        {roster.isPending ? (
          <EmptyNote>Loading players…</EmptyNote>
        ) : list.length === 0 ? (
          <EmptyNote>
            {debounced.trim()
              ? `No players match "${debounced.trim()}".`
              : 'No players recorded for this team yet. Lineups arrive with a game’s detail.'}
          </EmptyNote>
        ) : (
          <Card>
            {list.map((p) => {
              const on = favoriteIds.has(p.id);
              return (
                <Row
                  key={p.id}
                  title={p.full_name}
                  meta={rosterMeta(p)}
                  checked={on}
                  accessibilityLabel={`${p.full_name}, ${on ? 'remove from' : 'add to'} favorites`}
                  onPress={() =>
                    toggle.mutate({ player: { id: p.id, full_name: p.full_name }, on: !on })
                  }
                />
              );
            })}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

export default function RosterRoute() {
  return (
    <ReferenceThemeProvider team="none">
      <RosterBody />
    </ReferenceThemeProvider>
  );
}
