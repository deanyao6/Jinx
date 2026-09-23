import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { GameRow } from '@/components/GameRow';
import { Loading } from '@/components/Loading';
import { PageIntro } from '@/components/PageIntro';
import { Screen } from '@/components/Screen';
import { seenLine } from '@/features/players/passport';
import { useMyGamesWithPlayer, usePlayer } from '@/features/players/queries';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The games you saw one player in, newest first. Opened from a player superlative ("Seen Bryce
 * Harper play, 9 times"), so the number on the Passport is one tap from the games it counts.
 */
export default function PlayerGamesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const player = usePlayer(id);
  const games = useMyGamesWithPlayer(id);
  const name = player.data?.full_name ?? 'Player';
  return (
    <Screen>
      <Stack.Screen options={{ title: name }} />
      {games.isPending || player.isPending ? <Loading /> : null}
      {games.isError ? <ErrorNotice error={games.error} onRetry={games.refetch} /> : null}
      {player.isError ? <ErrorNotice error={player.error} onRetry={player.refetch} /> : null}
      {games.data && !player.isPending ? (
        <PageIntro
          kicker={seenLine(games.data.length)}
          title={name}
          body={
            games.data.length > 0
              ? 'Every game you were at that they played in. Tap one to open it.'
              : null
          }
        />
      ) : null}
      {games.data && games.data.length === 0 && !player.isPending ? (
        <EmptyState
          icon="i-eye"
          title="Not seen yet"
          body="Games appear here once you log one they played in."
        />
      ) : null}
      {games.data && games.data.length > 0 ? (
        <Card style={{ paddingVertical: theme.spacing.xs + 2 }}>
          {games.data.map((row, i) => (
            <GameRow
              key={row.attendance_id}
              first={i === 0}
              game={{
                ...row.game,
                awayName: row.game.away?.name ?? 'Away',
                homeName: row.game.home?.name ?? 'Home',
                venueName: row.game.venue?.name ?? null,
              }}
              onPress={() => router.push(`/games/${row.game.id}`)}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
