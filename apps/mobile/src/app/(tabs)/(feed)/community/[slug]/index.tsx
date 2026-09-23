import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Notice } from '@/components/Notice';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import {
  useCommunity,
  useCommunityFeed,
  useCommunityLeaderboard,
  useJoinCommunity,
  useLeaveCommunity,
} from '@/features/communities/queries';
import { REPORT_REASONS, useReport } from '@/features/social/queries';
import { statsForCommunity, type Sport } from '@jinx/core';
import { TeamTheme } from '@/theme/reference/TeamTheme';
import { useTheme } from '@/theme/ThemeProvider';

function relativeDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** One community: header, leaderboard previews, member feed (docs/prompts/social/04, section 1). */
export default function CommunityRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const community = useCommunity(slug);
  const join = useJoinCommunity();
  const leave = useLeaveCommunity();

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
  const previewStats = statsForCommunity(c.kind, c.sport_id as Sport | null).slice(0, 2);

  const body = (
    <CommunityBody
      slug={slug as string}
      communityId={c.id}
      name={c.name}
      memberCount={c.member_count}
      joined={c.joined}
      description={c.description}
      previewStatKeys={previewStats.length ? previewStats.map((s) => s.key) : ['games']}
      onJoin={() => join.mutate({ communityId: c.id })}
      onLeave={() => leave.mutate({ communityId: c.id })}
      busy={join.isPending || leave.isPending}
    />
  );

  return c.team_id ? <TeamTheme team={c.team_id}>{body}</TeamTheme> : body;
}

function CommunityBody({
  slug,
  communityId,
  name,
  memberCount,
  joined,
  description,
  previewStatKeys,
  onJoin,
  onLeave,
  busy,
}: {
  slug: string;
  communityId: string;
  name: string;
  memberCount: number;
  joined: boolean;
  description: string | null;
  previewStatKeys: string[];
  onJoin: () => void;
  onLeave: () => void;
  busy: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const feed = useCommunityFeed(joined ? communityId : undefined);
  const report = useReport();

  const onReport = () => {
    Alert.alert('Report this community', 'What is wrong with it?', [
      ...REPORT_REASONS.map((reason) => ({
        text: reason,
        onPress: () => {
          report.mutate({ targetType: 'community', targetId: communityId, reason });
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  return (
    <Screen>
      <Card tone="solid" style={{ marginBottom: theme.spacing.md }}>
        <Text variant="kicker" style={{ color: theme.accent.onFill }}>
          Community
        </Text>
        <Text variant="h1" style={{ color: theme.accent.onFill, marginTop: 4 }}>
          {name}
        </Text>
        <Text variant="sub" style={{ color: theme.accent.onFill, opacity: 0.75, marginTop: 4 }}>
          {memberCount.toLocaleString()} member{memberCount === 1 ? '' : 's'}
        </Text>
        {description ? (
          <Text variant="sub" style={{ color: theme.accent.onFill, opacity: 0.75, marginTop: 8 }}>
            {description}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: theme.spacing.md }}>
          <Button
            title={joined ? 'Leave' : 'Join'}
            variant={joined ? 'secondary' : 'primary'}
            onPress={joined ? onLeave : onJoin}
            disabled={busy}
          />
          <Button title="Report" variant="ghost" onPress={onReport} />
        </View>
      </Card>

      {joined ? (
        <>
          <SectionHeader
            title="Leaderboards"
            action="See all"
            onAction={() => router.push(`/community/${slug}/leaderboard`)}
          />
          {previewStatKeys.map((key) => (
            <LeaderboardPreview
              key={key}
              communityId={communityId}
              statKey={key}
              onPress={() =>
                router.push(`/community/${slug}/leaderboard?stat=${key}` as `/community/${string}`)
              }
            />
          ))}

          <SectionHeader title="Community feed" />
          {feed.isPending ? <Loading /> : null}
          {feed.data && feed.data.length === 0 ? (
            <Card>
              <Text color="muted">
                No public posts from members yet. Posts from people you do not follow show up
                here, never in Following.
              </Text>
            </Card>
          ) : null}
          {(feed.data ?? []).map((post) => (
            <Pressable
              key={post.post_id}
              accessibilityRole="button"
              onPress={() => router.push(`/post/${post.post_id}` as `/post/${string}`)}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Card style={{ paddingVertical: theme.spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <PersonAvatar
                    userId={post.author?.id}
                    name={post.author?.display_name}
                    handle={post.author?.handle}
                    path={post.author?.avatar_path}
                    size={36}
                  />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">
                      {post.author?.display_name || post.author?.handle || 'A member'}
                    </Text>
                    <Text variant="caption" color="muted" style={{ marginTop: 1 }}>
                      {post.caption ?? relativeDay(post.created_at)}
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </>
      ) : (
        <Card>
          <Text color="muted">Join to see leaderboards and the member feed.</Text>
        </Card>
      )}
    </Screen>
  );
}

function LeaderboardPreview({
  communityId,
  statKey,
  onPress,
}: {
  communityId: string;
  statKey: string;
  onPress: () => void;
}) {
  const board = useCommunityLeaderboard(communityId, 'season', 0, statKey, false);
  const viewer = board.data?.find((r) => r.is_viewer);
  const label = statKey
    .replace(/^(mlb|nfl|nba|mls)_/, '')
    .replace(/_/g, ' ');
  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{label.charAt(0).toUpperCase() + label.slice(1)}</Text>
          <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
            {viewer ? `You: ${viewer.value}, ${viewer.rank}${ordinalSuffix(viewer.rank)}` : 'Not ranked yet'}
          </Text>
        </View>
        <Button title="View" small variant="secondary" onPress={onPress} />
      </View>
    </Card>
  );
}

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}
