import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackHeader } from '@/components/reference/BackHeader';
import { Card, Row, SectionLabel } from '@/features/favorites/ui';
import { screen } from '@/features/favorites/screen';
import { ReferenceThemeProvider, useReferenceTheme } from '@/theme/reference/TeamTheme';

/**
 * Step one of both pickers: choose a league.
 *
 * The old picker listed all 62 teams at once behind a search box. Dean asked for a league
 * step first, which is also the only sane shape once a third league exists: the list of
 * leagues is short and stable, and every step after it is narrowed by the one before.
 *
 * `mode` decides where a league leads. Teams finish one step later; players have a team
 * step in between.
 */
const LEAGUES = [
  { id: 'mlb', name: 'Major League Baseball', meta: '30 teams' },
  { id: 'nfl', name: 'National Football League', meta: '32 teams' },
];

function LeagueBody() {
  const { base } = useReferenceTheme();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const players = mode === 'players';

  return (
    <View style={[screen.root, { paddingTop: insets.top, backgroundColor: base.scr }]}>
      <BackHeader
        title={players ? 'Add a player' : 'Add a team'}
        fallback={players ? '/settings/favorites?tab=players' : '/settings/favorites'}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <SectionLabel>Choose a league</SectionLabel>
        <Card>
          {LEAGUES.map((l) => (
            <Row
              key={l.id}
              title={l.name}
              meta={l.meta}
              chevron
              onPress={() =>
                router.push(
                  players
                    ? `/settings/favorites/players?sport=${l.id}`
                    : `/settings/favorites/teams?sport=${l.id}`,
                )
              }
            />
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

export default function LeagueRoute() {
  return (
    <ReferenceThemeProvider team="none">
      <LeagueBody />
    </ReferenceThemeProvider>
  );
}
