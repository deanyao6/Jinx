import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import {
  bucketListProgress,
  bucketProgressLabel,
  parseDefinition,
} from '@/features/bucketlists/progress';
import {
  useJoinBucketList,
  useJoinedBucketLists,
  useSyncBucketListProgress,
  useVisibleBucketLists,
} from '@/features/bucketlists/queries';
import { useGoalGames } from '@/features/goals/queries';
import { GoalRow } from '@/features/goals/ui/GoalRow';
import { useTheme } from '@/theme/ThemeProvider';

export default function BucketListsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const joined = useJoinedBucketLists();
  const visible = useVisibleBucketLists();
  const games = useGoalGames();
  const join = useJoinBucketList();

  const evaluated = useMemo(
    () =>
      (joined.data ?? []).map((j) => {
        const definition = parseDefinition(j.list.definition);
        const progress = games.data ? bucketListProgress(definition, games.data) : null;
        return { joined: j, definition, progress };
      }),
    [joined.data, games.data],
  );
  const syncItems = useMemo(
    () =>
      evaluated.map((e) => ({
        bucketListId: e.joined.bucket_list_id,
        stored: e.joined.progress,
        progress: e.progress,
      })),
    [evaluated],
  );
  useSyncBucketListProgress(syncItems);

  const joinedIds = new Set((joined.data ?? []).map((j) => j.bucket_list_id));
  const browse = (visible.data ?? []).filter((l) => !joinedIds.has(l.id));
  const curated = browse.filter((l) => l.is_curated);
  const mine = browse.filter((l) => !l.is_curated);

  return (
    <Screen>
      {joined.isPending || visible.isPending ? <Loading /> : null}
      {joined.isError ? <ErrorNotice error={joined.error} onRetry={joined.refetch} /> : null}
      {visible.isError ? <ErrorNotice error={visible.error} onRetry={visible.refetch} /> : null}
      {join.isError ? <Notice tone="error">{errorMessage(join.error)}</Notice> : null}

      {joined.data && joined.data.length === 0 ? (
        <Card>
          <Text variant="h2">Pick a list to chase</Text>
          <Text color="muted" style={{ marginTop: 4 }}>
            Every ballpark, a division, a walk-off. Unvisited venues show up as ghost stamps in your
            passport and on the map.
          </Text>
        </Card>
      ) : null}

      {evaluated.length > 0 ? (
        <Card label="Your lists">
          {evaluated.map(({ joined: j, definition, progress }, i) => (
            <GoalRow
              key={j.bucket_list_id}
              title={j.list.title}
              definition={definition}
              progress={progress}
              label={progress ? bucketProgressLabel(progress, definition) : undefined}
              last={i === evaluated.length - 1}
              onPress={() => router.push(`/passport/bucketlist/${j.bucket_list_id}`)}
            />
          ))}
        </Card>
      ) : null}

      {mine.length > 0 ? (
        <Card label="Your custom lists">
          {mine.map((l, i) => (
            <Row
              key={l.id}
              first={i === 0}
              title={l.title}
              subtitle={l.description}
              onPress={() => router.push(`/passport/bucketlist/${l.id}`)}
              right={
                <Button title="Join" small variant="secondary" onPress={() => join.mutate(l.id)} />
              }
            />
          ))}
        </Card>
      ) : null}

      {curated.length > 0 ? (
        <Card label="Browse">
          {curated.map((l, i) => (
            <Row
              key={l.id}
              first={i === 0}
              title={l.title}
              subtitle={l.description}
              onPress={() => router.push(`/passport/bucketlist/${l.id}`)}
              right={
                <Button title="Join" small variant="secondary" onPress={() => join.mutate(l.id)} />
              }
            />
          ))}
        </Card>
      ) : null}

      <View style={{ marginTop: theme.spacing.sm }}>
        <Button
          title="Create a list"
          variant="ghost"
          onPress={() => router.push('/passport/new-bucketlist')}
        />
      </View>
    </Screen>
  );
}
