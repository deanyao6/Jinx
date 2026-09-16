import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { GameRow } from '@/components/GameRow';
import { Loading } from '@/components/Loading';
import { Text } from '@/components/Text';
import { useMyAttendances } from '@/features/attendances/queries';
import { useUpcomingGames } from '@/features/games/queries';
import { useFavoriteTeams } from '@/features/profile/queries';
import { formatGameTime } from '@/lib/format';

/** Read-only: games you marked Going, then your teams' games in the next two weeks. */
export function UpcomingSegment({ onLog }: { onLog: () => void }) {
  const router = useRouter();
  const favorites = useFavoriteTeams();
  const attendances = useMyAttendances();
  const favIds = useMemo(() => (favorites.data ?? []).map((t) => t.id), [favorites.data]);
  const upcoming = useUpcomingGames(favIds);

  const going = useMemo(
    () =>
      (attendances.data ?? [])
        .filter((a) => a.status === 'going')
        .sort((a, b) => a.game.scheduled_start.localeCompare(b.game.scheduled_start)),
    [attendances.data],
  );
  const goingIds = useMemo(() => new Set(going.map((a) => a.game_id)), [going]);
  const teamGames = useMemo(
    () => (upcoming.data ?? []).filter((g) => !goingIds.has(g.id)),
    [upcoming.data, goingIds],
  );

  const loading = attendances.isPending || (favIds.length > 0 && upcoming.isPending);
  if (loading) return <Loading label="Loading upcoming games" />;
  if (attendances.isError && !attendances.data) {
    return <ErrorNotice error={attendances.error} onRetry={attendances.refetch} />;
  }
  if (upcoming.isError && !upcoming.data) {
    return <ErrorNotice error={upcoming.error} onRetry={upcoming.refetch} />;
  }

  if (going.length === 0 && teamGames.length === 0) {
    return (
      <EmptyState
        title="Nothing on the calendar"
        body={
          favIds.length
            ? 'Games for your teams in the next two weeks will show up here, along with any game you mark as Going.'
            : 'Pick favorite teams in the You tab to see their next games here.'
        }
        actionTitle="Log a game"
        onAction={onLog}
      />
    );
  }

  return (
    <>
      {going.length ? (
        <Card label="Going">
          {going.map((a, i) => (
            <GameRow
              key={a.id}
              first={i === 0}
              game={{
                id: a.game.id,
                scheduled_start: a.game.scheduled_start,
                status: a.game.status,
                awayName: a.game.away?.name ?? 'Away',
                homeName: a.game.home?.name ?? 'Home',
                venueName: a.game.venue?.name,
                home_score: a.game.home_score,
                away_score: a.game.away_score,
                doubleheader_number: a.game.doubleheader_number,
              }}
              right={
                <Text variant="caption" color="muted">
                  {formatGameTime(a.game.scheduled_start)}
                </Text>
              }
              onPress={() => router.push(`/games/${a.game.id}`)}
            />
          ))}
        </Card>
      ) : null}
      {teamGames.length ? (
        <Card label="Your teams, next 14 days">
          {teamGames.map((g, i) => (
            <GameRow
              key={g.id}
              first={i === 0}
              game={{
                id: g.id,
                scheduled_start: g.scheduled_start,
                status: g.status,
                awayName: g.away?.name ?? 'Away',
                homeName: g.home?.name ?? 'Home',
                venueName: g.venue?.name,
                home_score: g.home_score,
                away_score: g.away_score,
                doubleheader_number: g.doubleheader_number,
              }}
              right={
                <Text variant="caption" color="muted">
                  {formatGameTime(g.scheduled_start)}
                </Text>
              }
              onPress={() => router.push(`/games/${g.id}`)}
            />
          ))}
        </Card>
      ) : null}
    </>
  );
}
