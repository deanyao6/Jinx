import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckRow } from '@/components/CheckRow';
import { GameRow } from '@/components/GameRow';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { Text } from '@/components/Text';
import { Screen } from '@/components/Screen';
import { useAuthStore } from '@/features/auth/store';
import {
  bucketListProgress,
  bucketProgressLabel,
  listVenueIds,
  matchingGames,
  parseDefinition,
  visitedListVenues,
} from '@/features/bucketlists/progress';
import {
  useBucketList,
  useDeleteBucketList,
  useJoinBucketList,
  useJoinedBucketLists,
  useLeaveBucketList,
  useVenuesByIds,
} from '@/features/bucketlists/queries';
import { useGoalGames } from '@/features/goals/queries';
import { ProgressBar } from '@/features/goals/ui/ProgressBar';
import { progressRatio } from '@/features/goals/builder';
import { useGamesByIds } from '@/features/passport/queries';
import { useTheme } from '@/theme/ThemeProvider';

export default function BucketListDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const { id } = useLocalSearchParams<{ id: string }>();
  const list = useBucketList(id);
  const joined = useJoinedBucketLists();
  const games = useGoalGames();
  const join = useJoinBucketList();
  const leave = useLeaveBucketList();
  const remove = useDeleteBucketList();

  const definition = useMemo(() => parseDefinition(list.data?.definition), [list.data]);
  const progress = useMemo(
    () => (games.data ? bucketListProgress(definition, games.data) : null),
    [definition, games.data],
  );
  const venueIds = useMemo(() => listVenueIds(definition), [definition]);
  const venues = useVenuesByIds(venueIds);
  const visited = useMemo(
    () => visitedListVenues(definition, games.data ?? []),
    [definition, games.data],
  );
  const matched = useMemo(
    () => (venueIds.length ? [] : matchingGames(definition, games.data ?? [])),
    [definition, games.data, venueIds.length],
  );
  const matchedGames = useGamesByIds(matched.map((g) => g.gameId));

  const isJoined = (joined.data ?? []).some((j) => j.bucket_list_id === id);
  const isMine = !!list.data && !list.data.is_curated && list.data.owner_user_id === userId;

  const confirmDelete = () => {
    Alert.alert('Delete this list?', 'Only you can see it. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => remove.mutate(id as string, { onSuccess: () => router.back() }),
      },
    ]);
  };

  const l = list.data;
  const sortedVenues = useMemo(
    () =>
      [...(venues.data ?? [])].sort(
        (a, b) =>
          Number(visited.has(b.id)) - Number(visited.has(a.id)) || a.name.localeCompare(b.name),
      ),
    [venues.data, visited],
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: l?.title ?? 'Bucket list' }} />
      {list.isPending ? <Loading /> : null}
      {list.isError ? <ErrorNotice error={list.error} onRetry={list.refetch} /> : null}
      {join.isError || leave.isError ? (
        <Notice tone="error">{errorMessage(join.error ?? leave.error)}</Notice>
      ) : null}
      {l ? (
        <>
          <Card>
            <Text variant="h2">{l.title}</Text>
            {l.description ? (
              <Text color="muted" style={{ marginTop: 2 }}>
                {l.description}
              </Text>
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: theme.spacing.md,
              }}
            >
              <Text variant="caption" color="muted">
                {l.is_curated ? 'Curated list' : 'Custom list'}
              </Text>
              <Text
                variant="sub"
                color={progress?.completed ? 'green' : 'muted'}
                style={{ fontWeight: '700' }}
              >
                {progress ? bucketProgressLabel(progress, definition) : ''}
              </Text>
            </View>
            <ProgressBar
              ratio={progress ? progressRatio(progress) : 0}
              done={!!progress?.completed}
            />
            <View
              style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}
            >
              {isJoined ? (
                <Button
                  title="Leave list"
                  variant="ghost"
                  small
                  loading={leave.isPending}
                  onPress={() => leave.mutate(l.id)}
                />
              ) : (
                <Button
                  title="Join list"
                  small
                  loading={join.isPending}
                  onPress={() => join.mutate(l.id)}
                />
              )}
              {isMine ? (
                <Button title="Delete" variant="danger" small onPress={confirmDelete} />
              ) : null}
            </View>
          </Card>

          {venueIds.length > 0 ? (
            <Card label={`${visited.size} of ${venueIds.length} visited`}>
              {venues.isPending ? <Loading /> : null}
              {sortedVenues.map((v, i) => (
                <CheckRow
                  key={v.id}
                  first={i === 0}
                  title={v.name}
                  subtitle={[v.city, v.state].filter(Boolean).join(', ')}
                  checked={visited.has(v.id)}
                  trailing={v.closed_year ? `Closed ${v.closed_year}` : null}
                />
              ))}
            </Card>
          ) : null}

          {venueIds.length === 0 && definition ? (
            <Card
              label={
                matched.length
                  ? `${matched.length} matching ${matched.length === 1 ? 'game' : 'games'}`
                  : 'Matching games'
              }
            >
              {matched.length === 0 ? (
                <Text variant="sub" color="muted">
                  None yet. It counts the first time one of your attended games matches.
                </Text>
              ) : null}
              {matched.map((g, i) => {
                const full = matchedGames.data?.get(g.gameId);
                if (!full) return null;
                return (
                  <GameRow
                    key={g.gameId}
                    first={i === 0}
                    game={{
                      ...full,
                      awayName: full.away?.name ?? 'Away',
                      homeName: full.home?.name ?? 'Home',
                      venueName: full.venue?.name ?? null,
                    }}
                    onPress={() => router.push(`/games/${g.gameId}`)}
                  />
                );
              })}
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
