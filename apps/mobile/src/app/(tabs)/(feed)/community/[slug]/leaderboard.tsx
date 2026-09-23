import { statsForCommunity, type Sport } from '@jinx/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Notice } from '@/components/Notice';
import { PageIntro } from '@/components/PageIntro';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import {
  useCommunity,
  useCommunityLeaderboard,
  useSeasonStatus,
  type LeaderboardPeriod,
} from '@/features/communities/queries';
import { TeamTheme } from '@/theme/reference/TeamTheme';
import { useTheme } from '@/theme/ThemeProvider';

function statLabel(key: string): string {
  const label = key.replace(/^(mlb|nfl|nba|mls)_/, '').replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: 'season', label: 'This season' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

/** A community's leaderboard (docs/prompts/social/04, section 2): stat and period filters, a
 * friends-only toggle, and only verified attendance ranks. */
export default function LeaderboardRoute() {
  const { slug, stat: initialStat } = useLocalSearchParams<{ slug: string; stat?: string }>();
  const community = useCommunity(slug);

  if (community.isPending) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (community.isError) {
    return (
      <Screen>
        <ErrorNotice error={community.error} onRetry={community.refetch} />
      </Screen>
    );
  }
  if (!community.data) {
    return (
      <Screen>
        <Notice tone="error">This community does not exist.</Notice>
      </Screen>
    );
  }

  const c = community.data;
  const body = <LeaderboardBody communityId={c.id} kind={c.kind} sportId={c.sport_id} initialStat={initialStat} />;
  return c.team_id ? <TeamTheme team={c.team_id}>{body}</TeamTheme> : body;
}

function LeaderboardBody({
  communityId,
  kind,
  sportId,
  initialStat,
}: {
  communityId: string;
  kind: 'team' | 'venue' | 'school' | 'custom';
  sportId: string | null;
  initialStat?: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const status = useSeasonStatus();
  const stats = useMemo(() => statsForCommunity(kind, sportId as Sport | null), [kind, sportId]);
  const [statKey, setStatKey] = useState(
    initialStat && stats.some((s) => s.key === initialStat) ? initialStat : (stats[0]?.key ?? 'games'),
  );
  const [period, setPeriod] = useState<LeaderboardPeriod>('season');
  const [friendsOnly, setFriendsOnly] = useState(false);

  const sportStatus = sportId ? status.data?.find((s) => s.sport_id === sportId) : null;
  const season =
    period === 'all'
      ? 0
      : period === 'season'
        ? (sportStatus?.season ?? new Date().getFullYear())
        : new Date().getFullYear() * 100 + (new Date().getMonth() + 1);

  const board = useCommunityLeaderboard(communityId, period, season, statKey, friendsOnly);
  // The server already returns ranks 1..50 in order, plus the viewer's own row appended (still
  // in rank order) when it falls outside that page: a gap in consecutive rank means it is pinned.
  const rows = board.data ?? [];
  const last = rows[rows.length - 1];
  const secondLast = rows[rows.length - 2];
  const viewerPinned =
    !!last && last.is_viewer && (!secondLast || last.rank > secondLast.rank + 1);
  const page = viewerPinned ? rows.slice(0, -1) : rows;
  const viewer = viewerPinned ? last : undefined;

  return (
    <Screen>
      <PageIntro kicker="Ranked, inside this community" title="Leaderboard" />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.sm }}>
        {stats.map((s) => (
          <Chip key={s.key} label={s.label} selected={s.key === statKey} onPress={() => setStatKey(s.key)} />
        ))}
      </View>

      <Segmented options={PERIODS} value={period} onChange={setPeriod} />
      <View style={{ marginTop: -theme.spacing.sm, marginBottom: theme.spacing.sm }}>
        <Chip label="Friends only" selected={friendsOnly} onPress={() => setFriendsOnly((v) => !v)} />
      </View>

      <Notice>
        Only verified attendance ranks: a check-in or a matched ticket. Unverified games still
        count on your own passport.
      </Notice>

      {board.isPending ? <Loading /> : null}
      {board.isError ? <ErrorNotice error={board.error} onRetry={board.refetch} /> : null}
      {board.data && board.data.length === 0 ? (
        <Notice>Nobody has ranked yet for {statLabel(statKey).toLowerCase()}.</Notice>
      ) : null}

      {page.map((row) => (
        <LeaderboardRowView
          key={row.user_id}
          rank={row.rank}
          name={row.display_name || row.handle}
          value={row.value}
          isViewer={row.is_viewer}
          avatarPath={row.avatar_path}
          userId={row.user_id}
          onPress={() => router.push(`/u/${row.handle}` as `/u/${string}`)}
        />
      ))}

      {viewer ? (
        <>
          <View style={{ height: 1, backgroundColor: 'transparent', marginVertical: 6 }} />
          <LeaderboardRowView
            rank={viewer.rank}
            name={viewer.display_name || viewer.handle}
            value={viewer.value}
            isViewer
            avatarPath={viewer.avatar_path}
            userId={viewer.user_id}
            pinned
            onPress={() => router.push(`/u/${viewer.handle}` as `/u/${string}`)}
          />
        </>
      ) : null}
    </Screen>
  );
}

function LeaderboardRowView({
  rank,
  name,
  value,
  isViewer,
  avatarPath,
  userId,
  pinned = false,
  onPress,
}: {
  rank: number;
  name: string;
  value: number;
  isViewer: boolean;
  avatarPath: string | null;
  userId: string;
  pinned?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: pinned ? theme.spacing.md : 0,
        backgroundColor: pinned ? theme.accent.wash : 'transparent',
        borderRadius: pinned ? theme.radius.md : 0,
        marginTop: pinned ? 4 : 0,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text variant="bodyStrong" color={isViewer ? 'accent' : 'ink'} style={{ width: 28 }}>
        {rank}
      </Text>
      <PersonAvatar userId={userId} name={name} path={avatarPath} size={32} ring={isViewer} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" color={isViewer ? 'accent' : 'ink'}>
          {isViewer ? `${name} (you)` : name}
        </Text>
        {pinned ? (
          <Text variant="caption" color="muted">
            Off the visible page
          </Text>
        ) : null}
      </View>
      <Text variant="bodyStrong">{value}</Text>
    </Pressable>
  );
}
