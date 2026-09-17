import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, View, type ViewStyle } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { GameRow } from '@/components/GameRow';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
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
  type VenueLite,
} from '@/features/bucketlists/queries';
import { listSport } from '@/features/bucketlists/ui/sport';
import { VenueStamp } from '@/features/bucketlists/ui/VenueStamp';
import { useGoalGames } from '@/features/goals/queries';
import { ProgressCount } from '@/features/goals/ui/GoalCard';
import { progressRatio } from '@/features/goals/builder';
import { useGamesByIds } from '@/features/passport/queries';
import { defaultShapeKey, useVenueShapes } from '@/features/venues/shapes';
import { sportLabel } from '@/lib/format';
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

  const sport = listSport(l?.slug ?? null);
  const shapes = useVenueShapes();
  const shapeOf = useMemo(
    () => new Map((shapes.data ?? []).map((r) => [r.venue_id, r.shape_key])),
    [shapes.data],
  );
  const seen = sortedVenues.filter((v) => visited.has(v.id));
  const unseen = sortedVenues.filter((v) => !visited.has(v.id));
  // The hero keeps the count when the list is finished ("30 of 30"), where a row says "Done".
  const heroLabel =
    progress && definition && definition.type !== 'exists' && definition.type !== 'any_of'
      ? `${progress.current} of ${progress.target}`
      : bucketProgressLabel(progress, definition);
  const stampGrid: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: 0,
  };
  const stamp = (v: VenueLite) => (
    <VenueStamp
      key={v.id}
      name={v.name}
      place={[v.city, v.state].filter(Boolean).join(', ')}
      note={v.closed_year ? `Closed ${v.closed_year}` : null}
      shapeKey={shapeOf.get(v.id) ?? defaultShapeKey(sport ? [sport] : [])}
      visited={visited.has(v.id)}
    />
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
          <Card tone="accent">
            <Text variant="kicker" color="accent">
              {[sport ? sportLabel(sport) : null, l.is_curated ? 'Curated list' : 'Custom list']
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text variant="h2" style={{ marginTop: 4 }}>
              {l.title}
            </Text>
            {l.description ? (
              <Text variant="sub" color="muted" style={{ marginTop: 2 }}>
                {l.description}
              </Text>
            ) : null}
            <View style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.md }}>
              {progress ? <ProgressCount big label={heroLabel} done={progress.completed} /> : null}
            </View>
            <ProgressBar
              value={progress ? progressRatio(progress) : 0}
              done={!!progress?.completed}
              height={10}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                marginTop: theme.spacing.lg,
              }}
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
                  loading={join.isPending}
                  onPress={() => join.mutate(l.id)}
                  style={{ flex: 1 }}
                />
              )}
              {isMine ? (
                <Button title="Delete" variant="danger" small onPress={confirmDelete} />
              ) : null}
            </View>
          </Card>

          {venueIds.length > 0 ? (
            <View style={{ marginTop: theme.spacing.sm }}>
              {venues.isPending ? <Loading /> : null}
              {seen.length > 0 ? (
                <>
                  <SectionHeader title={`${visited.size} of ${venueIds.length} visited`} />
                  <Card style={stampGrid}>{seen.map(stamp)}</Card>
                </>
              ) : null}
              {unseen.length > 0 ? (
                <>
                  <SectionHeader title={`${unseen.length} to go`} />
                  <Card style={stampGrid}>{unseen.map(stamp)}</Card>
                </>
              ) : null}
            </View>
          ) : null}

          {venueIds.length === 0 && definition ? (
            <View style={{ marginTop: theme.spacing.sm }}>
              <SectionHeader
                title={
                  matched.length
                    ? `${matched.length} matching ${matched.length === 1 ? 'game' : 'games'}`
                    : 'Matching games'
                }
              />
              <Card>
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
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
