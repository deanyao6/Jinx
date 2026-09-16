import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackHeader } from '@/components/reference/BackHeader';
import { Card, EmptyNote, Row, SectionLabel, Segments } from '@/features/favorites/ui';
import { useFavoritePlayers, useToggleFavoritePlayer } from '@/features/players/queries';
import { useFavoriteTeams, useSetFavoriteTeams } from '@/features/profile/queries';
import { sportLabel } from '@/lib/format';
import { screen } from '@/features/favorites/screen';
import { ReferenceThemeProvider, useReferenceTheme } from '@/theme/reference/TeamTheme';

type Tab = 'teams' | 'players';

const TABS = [
  { key: 'teams' as const, label: 'Teams' },
  { key: 'players' as const, label: 'Players' },
];

/**
 * Settings > Favourites, with a tab each for teams and players (SPEC.md 5.1, 6.9).
 *
 * Favourite teams used to live inside Edit profile, next to your name and handle, as one
 * long checklist of all 62 teams. They are not profile fields: they decide what the
 * passport counts, which pills appear, and which games are yours. So they get their own
 * place, and players join them.
 *
 * Both tabs show what you have and send you to a picker to add more. Removing happens
 * here, adding happens in the picker, which is why a row on this screen is a toggle that
 * only ever turns things off.
 */
function FavoritesBody() {
  const { base } = useReferenceTheme();
  const params = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // The picker pushes back here with ?tab=players so you land where you left.
  const [tab, setTab] = React.useState<Tab>(params.tab === 'players' ? 'players' : 'teams');

  const teams = useFavoriteTeams();
  const setTeams = useSetFavoriteTeams();
  const players = useFavoritePlayers();
  const togglePlayer = useToggleFavoritePlayer();

  const teamList = teams.data ?? [];
  const playerList = players.data ?? [];

  return (
    <View style={[screen.root, { paddingTop: insets.top, backgroundColor: base.scr }]}>
      <BackHeader title="Favorites" fallback="/settings" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <Segments options={TABS} value={tab} onChange={setTab} />

        {tab === 'teams' ? (
          <>
            <Card>
              <Row
                title="Add a team"
                meta="Pick a league, then a team"
                chevron
                onPress={() => router.push('/settings/favorites/league?mode=teams')}
              />
            </Card>
            <SectionLabel>
              {teamList.length === 1 ? '1 team' : `${teamList.length} teams`}
            </SectionLabel>
            {teamList.length === 0 ? (
              <EmptyNote>
                No favorite teams yet. Your passport uses these to decide which games count as
                yours.
              </EmptyNote>
            ) : (
              <Card>
                {teamList.map((t) => (
                  <Row
                    key={t.id}
                    title={t.name}
                    meta={sportLabel(t.sport_id)}
                    checked
                    accessibilityLabel={`${t.name}, remove from favorites`}
                    onPress={() => setTeams.mutate(teamList.filter((other) => other.id !== t.id))}
                  />
                ))}
              </Card>
            )}
          </>
        ) : (
          <>
            <Card>
              <Row
                title="Add a player"
                meta="Pick a league, then a team, then a player"
                chevron
                onPress={() => router.push('/settings/favorites/league?mode=players')}
              />
            </Card>
            <SectionLabel>
              {playerList.length === 1 ? '1 player' : `${playerList.length} players`}
            </SectionLabel>
            {playerList.length === 0 ? (
              <EmptyNote>
                No favorite players yet. Follow someone and your passport can tell you how many
                times you have seen them play.
              </EmptyNote>
            ) : (
              <Card>
                {playerList.map((p) => (
                  <Row
                    key={p.id}
                    title={p.full_name}
                    checked
                    accessibilityLabel={`${p.full_name}, remove from favorites`}
                    onPress={() => togglePlayer.mutate({ player: p, on: false })}
                  />
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

export default function FavoritesRoute() {
  return (
    <ReferenceThemeProvider team="none">
      <FavoritesBody />
    </ReferenceThemeProvider>
  );
}
