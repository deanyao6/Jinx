import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorNotice } from '@/components/ErrorNotice';
import { IconTile } from '@/components/IconTile';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { PageIntro } from '@/components/PageIntro';
import type { IconName } from '@/components/reference/icons';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import {
  bucketListProgress,
  bucketProgressLabel,
  listVenueIds,
  parseDefinition,
  visitedListVenues,
} from '@/features/bucketlists/progress';
import {
  useJoinBucketList,
  useJoinedBucketLists,
  useSyncBucketListProgress,
  useVisibleBucketLists,
  type BucketList,
} from '@/features/bucketlists/queries';
import { SealRow } from '@/features/bucketlists/ui/SealRow';
import { groupBySport, listSport } from '@/features/bucketlists/ui/sport';
import { useGoalGames } from '@/features/goals/queries';
import { GoalCard } from '@/features/goals/ui/GoalCard';
import { defaultShapeKey, useVenueShapes } from '@/features/venues/shapes';
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

  // The Passport tab already holds this in the cache; a venue with no row takes its sport's shape.
  const shapes = useVenueShapes();
  const shapeOf = useMemo(
    () => new Map((shapes.data ?? []).map((r) => [r.venue_id, r.shape_key])),
    [shapes.data],
  );

  const joinedIds = new Set((joined.data ?? []).map((j) => j.bucket_list_id));
  const browse = (visible.data ?? []).filter((l) => !joinedIds.has(l.id));
  const curated = browse.filter((l) => l.is_curated);
  const mine = browse.filter((l) => !l.is_curated);
  const groups = groupBySport(curated);

  const browseCard = (lists: BucketList[], icon: IconName) => (
    <Card style={{ paddingVertical: theme.spacing.xs }}>
      {lists.map((l, i) => (
        <Row
          key={l.id}
          first={i === 0}
          icon={icon}
          title={l.title}
          subtitle={l.description}
          onPress={() => router.push(`/passport/bucketlist/${l.id}`)}
          right={
            <Button title="Join" small variant="secondary" onPress={() => join.mutate(l.id)} />
          }
        />
      ))}
    </Card>
  );

  return (
    <Screen>
      <PageIntro
        kicker={evaluated.length > 0 ? `${evaluated.length} joined` : 'Stadiums and moments'}
        title="Bucket lists"
        body="Stadiums you have not been to yet show up as ghost stamps in your passport and on the map."
      />
      {joined.isPending || visible.isPending ? <Loading /> : null}
      {joined.isError ? <ErrorNotice error={joined.error} onRetry={joined.refetch} /> : null}
      {visible.isError ? <ErrorNotice error={visible.error} onRetry={visible.refetch} /> : null}
      {join.isError ? <Notice tone="error">{errorMessage(join.error)}</Notice> : null}

      {joined.data && joined.data.length === 0 ? (
        <Card tone="accent">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <IconTile icon="i-target" size={44} solid />
            <View style={{ flex: 1 }}>
              <Text variant="h2">Pick a list to chase</Text>
              <Text variant="sub" color="muted" style={{ marginTop: 2 }}>
                Every stadium in a league, a division, a walk-off. Join one below.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {evaluated.length > 0 ? (
        <View style={{ marginBottom: theme.spacing.sm }}>
          <SectionHeader title="Your lists" />
          {evaluated.map(({ joined: j, definition, progress }) => {
            const ids = listVenueIds(definition);
            const sport = listSport(j.list.slug);
            const visited = ids.length ? visitedListVenues(definition, games.data ?? []) : null;
            return (
              <GoalCard
                key={j.bucket_list_id}
                title={j.list.title}
                definition={definition}
                progress={progress}
                label={progress ? bucketProgressLabel(progress, definition) : undefined}
                onPress={() => router.push(`/passport/bucketlist/${j.bucket_list_id}`)}
              >
                {visited ? (
                  <SealRow
                    total={ids.length}
                    visitedShapes={Array.from(visited).map(
                      (id) => shapeOf.get(id) ?? defaultShapeKey(sport ? [sport] : []),
                    )}
                  />
                ) : null}
              </GoalCard>
            );
          })}
        </View>
      ) : null}

      {mine.length > 0 ? (
        <View style={{ marginBottom: theme.spacing.sm }}>
          <SectionHeader title="Your custom lists" />
          {browseCard(mine, 'i-flag')}
        </View>
      ) : null}

      {groups.length > 0 ? (
        <Text variant="kicker" color="accent" style={{ marginTop: theme.spacing.sm }}>
          Browse
        </Text>
      ) : null}
      {groups.map((g) => (
        <View key={g.key} style={{ marginBottom: theme.spacing.sm }}>
          <SectionHeader title={g.title} />
          {browseCard(g.lists, g.key === 'moments' ? 'i-bolt' : 'i-map')}
        </View>
      ))}

      <View style={{ marginTop: theme.spacing.sm }}>
        <Button
          title="Create a list"
          variant="secondary"
          onPress={() => router.push('/passport/new-bucketlist')}
        />
      </View>
    </Screen>
  );
}
