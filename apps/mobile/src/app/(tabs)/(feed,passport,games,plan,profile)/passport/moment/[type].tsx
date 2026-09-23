import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { GameRow } from '@/components/GameRow';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { PageIntro } from '@/components/PageIntro';
import { Screen } from '@/components/Screen';
import { momentDetail, momentLabel } from '@/features/attendances/moments';
import { useMomentGames } from '@/features/passport/queries';
import { momentIcon } from '@/features/passport/ui/MomentTrophies';
import { useTheme } from '@/theme/ThemeProvider';

export default function MomentGamesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { type } = useLocalSearchParams<{ type: string }>();
  const games = useMomentGames(type);
  const label = type ? momentLabel(type) : 'Moment';
  return (
    <Screen>
      <Stack.Screen options={{ title: label }} />
      {games.isPending ? <Loading /> : null}
      {games.isError ? <ErrorNotice error={games.error} onRetry={games.refetch} /> : null}
      {games.data && games.data.length === 0 ? (
        <EmptyState icon={momentIcon(type ?? '')} title={`No ${label.toLowerCase()} yet`} />
      ) : null}
      {games.data && games.data.length > 0 ? (
        <PageIntro
          kicker={label}
          title={`${games.data.length} ${games.data.length === 1 ? 'game' : 'games'}`}
          body="Every game you were at when it happened. Tap one to open it."
        />
      ) : null}
      {games.data && games.data.length > 0 ? (
        <Card style={{ paddingVertical: theme.spacing.xs + 2 }}>
          {games.data.map((row, i) => {
            const ev = row.game.events.find((e) => e.type === type) ?? row.game.events[0];
            const detail = ev ? momentDetail(ev.type, ev.detail ?? {}) : null;
            const badge = [ev?.player?.full_name, detail].filter(Boolean).join(', ') || label;
            return (
              <GameRow
                key={row.attendance_id}
                first={i === 0}
                game={{
                  ...row.game,
                  awayName: row.game.away?.name ?? 'Away',
                  homeName: row.game.home?.name ?? 'Home',
                  venueName: row.game.venue?.name ?? null,
                }}
                badge={badge}
                onPress={() => router.push(`/games/${row.game.id}`)}
              />
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}
