import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { ErrorNotice, StaleNotice } from '@/components/ErrorNotice';
import { LegacyBackButton } from '@/components/reference/BackHeader';
import { Row } from '@/components/Row';
import { Text } from '@/components/Text';
import { useGhostVenues, useJoinedBucketLists } from '@/features/bucketlists/queries';
import { evaluateGoals, useGoalGames, useGoals } from '@/features/goals/queries';
import { GoalRow } from '@/features/goals/ui/GoalRow';
import {
  isEmptyStats,
  possessive,
  stampNumber,
  superlativeRows,
  totalsLine,
} from '@/features/passport/format';
import { useLatestWrapped, useMyStats, useRefreshStats } from '@/features/passport/queries';
import type { StatsStamp } from '@/features/passport/types';
import {
  MomentsRow,
  PassportRecordCard,
  Sheet,
  StampsGrid,
  SuperlativesList,
  VenueSheet,
} from '@/features/passport/ui';
import { useProfile } from '@/features/profile/queries';
import { openShare } from '@/features/share/navigate';
import { ShareButton } from '@/features/share/ShareButton';
import { currentSeason, sportLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

function CardHeader({
  label,
  action,
  onPress,
}: {
  label: string;
  action?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
      }}
    >
      <Text variant="caption" color="muted">
        {label}
      </Text>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action ?? 'See all'} ${label.toLowerCase()}`}
          onPress={onPress}
          hitSlop={8}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text variant="caption" color="blue" style={{ fontWeight: '700' }}>
            {action ?? 'See all'}
          </Text>
          <Ionicons name="chevron-forward" size={12} color={theme.colors.blue} />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function PassportScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const year = currentSeason();

  const profile = useProfile();
  const stats = useMyStats();
  const refresh = useRefreshStats();
  const wrapped = useLatestWrapped();
  const goals = useGoals(year);
  const goalGames = useGoalGames();
  const joinedLists = useJoinedBucketLists();

  const s = stats.data;
  const visitedIds = useMemo(() => (s?.stamps ?? []).map((st) => st.venue_id), [s]);
  const { ghosts } = useGhostVenues(visitedIds);

  const [pledgeInfo, setPledgeInfo] = useState(false);
  const [venue, setVenue] = useState<StatsStamp | null>(null);

  const evaluated = useMemo(
    () => evaluateGoals(goals.data ?? [], goalGames.data ?? []),
    [goals.data, goalGames.data],
  );
  const topGoals = useMemo(
    () =>
      [...evaluated]
        .sort((a, b) => Number(!!a.progress?.completed) - Number(!!b.progress?.completed))
        .slice(0, 2),
    [evaluated],
  );

  const superlatives = useMemo(
    () => (s ? superlativeRows(s.superlatives, s.moments, s.streaks) : []),
    [s],
  );

  const name = profile.data?.display_name?.trim() || 'Your';
  const title = profile.data?.display_name?.trim()
    ? `${possessive(name)} passport`
    : 'Your passport';

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: c.screen }}
        contentContainerStyle={{
          paddingTop: insets.top + theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refresh.isPending}
            onRefresh={() => refresh.mutate()}
            tintColor={c.muted}
          />
        }
      >
        <LegacyBackButton fallback="/" />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="h1">{title}</Text>
            <Text variant="sub" color="muted" style={{ marginBottom: theme.spacing.md }}>
              {s ? totalsLine(s.totals) : ' '}
            </Text>
          </View>
          {s && !isEmptyStats(s) ? (
            <ShareButton
              label="Share your record"
              onPress={() =>
                openShare(router, {
                  kind: 'record',
                  overall: s.overall,
                  teams: s.teams.map((t) => ({ name: t.name, record: t.record })),
                  pledge: s.pledge,
                  totals: s.totals,
                })
              }
            />
          ) : null}
        </View>

        {stats.isPending ? <Loading label="Adding up your games" /> : null}
        {stats.isError && !s ? <ErrorNotice error={stats.error} onRetry={stats.refetch} /> : null}
        {stats.isError && s ? <StaleNotice onRetry={stats.refetch} /> : null}
        {refresh.isError ? <ErrorNotice error={refresh.error} /> : null}

        {s && isEmptyStats(s) ? (
          <Card>
            <EmptyState
              title="No stamps yet"
              body="Every game you attend becomes a stamp, a record, and a story. Log one and your passport fills in."
              actionTitle="Log your first game"
              onAction={() => router.navigate('/(tabs)/games?segment=log')}
            />
          </Card>
        ) : null}

        {wrapped.data ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push(`/wrapped/${wrapped.data?.sport_id}/${wrapped.data?.season}` as Href)
            }
            style={({ pressed }) => ({
              backgroundColor: c.ink,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.lg - 2,
              marginBottom: theme.spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ flex: 1 }}>
              <Text variant="h2" color="onInk">
                {wrapped.data.season} {sportLabel(wrapped.data.sport_id)} Wrapped
              </Text>
              <Text variant="sub" color="onInk" style={{ opacity: 0.8 }}>
                Your season, card by card. Tap to open.
              </Text>
            </View>
            <Ionicons name="sparkles" size={22} color={c.onInk} />
          </Pressable>
        ) : null}

        {s && !isEmptyStats(s) ? (
          <>
            <PassportRecordCard
              overall={s.overall}
              teams={s.teams}
              pledge={s.pledge}
              onPledgeInfo={() => setPledgeInfo(true)}
            />

            <Card>
              <CardHeader
                label="Venue stamps"
                action={`All ${s.stamps.length}`}
                onPress={() => router.push('/passport/stamps')}
              />
              <StampsGrid
                stamps={s.stamps}
                ghosts={ghosts}
                limit={6}
                onPressStamp={setVenue}
                onPressGhost={() => router.push('/passport/bucketlists')}
              />
            </Card>

            {superlatives.length > 0 ? (
              <Card>
                <CardHeader
                  label="Superlatives"
                  onPress={() => router.push('/passport/superlatives')}
                />
                <SuperlativesList
                  rows={superlatives}
                  limit={4}
                  onPressRow={(row) => {
                    if (row.gameId) router.push(`/games/${row.gameId}`);
                    else router.push('/passport/superlatives');
                  }}
                />
              </Card>
            ) : null}

            <Card>
              <CardHeader
                label="Moments witnessed"
                onPress={s.moments.length ? () => router.push('/passport/moments') : undefined}
              />
              <MomentsRow
                moments={s.moments}
                limit={6}
                onPress={(type) => router.push(`/passport/moment/${type}`)}
              />
            </Card>

            <Card>
              <Row
                first
                chevron
                title="Players seen"
                subtitle="Sorted by how often you have seen them"
                right={
                  <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                    {s.players_seen}
                  </Text>
                }
                onPress={() => router.push('/passport/players')}
              />
              <Row
                chevron
                title="Map"
                subtitle={`${s.totals.venues} ${s.totals.venues === 1 ? 'venue' : 'venues'} in ${
                  s.totals.states
                } ${s.totals.states === 1 ? 'state' : 'states'}`}
                onPress={() => router.push('/passport/map')}
              />
            </Card>
          </>
        ) : null}

        {s ? (
          <Card>
            <CardHeader
              label={`${year} goals`}
              action={goals.data?.length ? 'All goals' : 'Add a goal'}
              onPress={() => router.push('/passport/goals')}
            />
            {goals.isPending || goalGames.isPending ? <Loading /> : null}
            {topGoals.map(({ goal, definition, progress }, i) => (
              <GoalRow
                key={goal.id}
                title={goal.title}
                definition={definition}
                progress={progress}
                last={i === topGoals.length - 1}
                onPress={() => router.push('/passport/goals')}
              />
            ))}
            {goals.data && goals.data.length === 0 ? (
              <Text variant="sub" color="muted">
                No goals for {year} yet. Pick a template or build your own.
              </Text>
            ) : null}
            <Row
              chevron
              title="Bucket lists"
              subtitle="Every venue, every division, and the rare stuff"
              right={
                joinedLists.data ? (
                  <Text variant="caption" color="muted">
                    {joinedLists.data.length} joined
                  </Text>
                ) : null
              }
              onPress={() => router.push('/passport/bucketlists')}
            />
          </Card>
        ) : null}

        {s?.computed_at ? (
          <Text variant="caption" color="muted" align="center">
            Pull down to recount. Updated {new Date(s.computed_at).toLocaleString()}.
          </Text>
        ) : null}
      </ScrollView>

      <Sheet visible={pledgeInfo} title="Pledged record" onClose={() => setPledgeInfo(false)}>
        <Text style={{ marginBottom: theme.spacing.md }}>
          At games where you do not have a team, you pledge a side before the game locks. Those
          picks build your pledged record.
        </Text>
        <Text variant="bodyStrong" style={{ marginBottom: 4 }}>
          Vs expected
        </Text>
        <Text color="muted">
          How many more wins you have picked than expected. Each pledge is worth 1 for a win minus
          the win probability at the time you pledged, so backing an underdog that wins counts for
          more than backing a favorite.
        </Text>
      </Sheet>
      <VenueSheet
        stamp={venue}
        stampNumber={venue && s ? stampNumber(s.stamps, venue.venue_id) : null}
        onClose={() => setVenue(null)}
      />
    </>
  );
}
