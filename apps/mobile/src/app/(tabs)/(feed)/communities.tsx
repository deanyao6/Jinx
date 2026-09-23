import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { PageIntro } from '@/components/PageIntro';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import {
  useCommunities,
  useJoinCommunity,
  useLeaveCommunity,
  type CommunityKind,
  type CommunitySummary,
} from '@/features/communities/queries';
import { useTheme } from '@/theme/ThemeProvider';

const GROUP_TITLES: Record<CommunityKind, string> = {
  team: 'Teams',
  venue: 'Venues',
  school: 'Schools',
  custom: 'Communities',
};

function memberLine(n: number): string {
  return `${n.toLocaleString()} member${n === 1 ? '' : 's'}`;
}

/** Joinable communities (docs/prompts/social/04, section 1): one per team, venue and school. */
export default function CommunitiesRoute() {
  const theme = useTheme();
  const router = useRouter();
  const communities = useCommunities();
  const join = useJoinCommunity();
  const leave = useLeaveCommunity();

  const groups = useMemo(() => {
    const byKind = new Map<CommunityKind, CommunitySummary[]>();
    for (const c of communities.data ?? []) {
      const list = byKind.get(c.kind) ?? [];
      list.push(c);
      byKind.set(c.kind, list);
    }
    return (['team', 'venue', 'school', 'custom'] as const)
      .map((kind) => ({ kind, items: byKind.get(kind) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [communities.data]);

  const joined = (communities.data ?? []).filter((c) => c.joined);

  return (
    <Screen>
      <PageIntro
        kicker={joined.length > 0 ? `${joined.length} joined` : 'Joinable, like a subreddit'}
        title="Communities"
        body="One for every team, venue and school. Leaderboards live inside them, so rank is always winnable."
      />
      {communities.isPending ? <Loading /> : null}
      {communities.isError ? (
        <ErrorNotice error={communities.error} onRetry={communities.refetch} />
      ) : null}

      {joined.length > 0 ? (
        <View style={{ marginBottom: theme.spacing.sm }}>
          <SectionHeader title="Yours" />
          <Card style={{ paddingVertical: theme.spacing.xs }}>
            {joined.map((c, i) => (
              <Row
                key={c.id}
                first={i === 0}
                icon="i-flag"
                title={c.name}
                subtitle={memberLine(c.member_count)}
                onPress={() => router.push(`/community/${c.slug}`)}
              />
            ))}
          </Card>
        </View>
      ) : null}

      {groups.map((g) => (
        <View key={g.kind} style={{ marginBottom: theme.spacing.sm }}>
          <SectionHeader title={GROUP_TITLES[g.kind]} />
          <Card style={{ paddingVertical: theme.spacing.xs }}>
            {g.items.map((c, i) => (
              <Row
                key={c.id}
                first={i === 0}
                icon={g.kind === 'venue' ? 'i-map' : g.kind === 'school' ? 'i-book' : 'i-flag'}
                title={c.name}
                subtitle={memberLine(c.member_count)}
                onPress={() => router.push(`/community/${c.slug}`)}
                right={
                  <Button
                    title={c.joined ? 'Joined' : 'Join'}
                    small
                    variant={c.joined ? 'secondary' : 'primary'}
                    onPress={() =>
                      c.joined
                        ? leave.mutate({ communityId: c.id })
                        : join.mutate({ communityId: c.id })
                    }
                  />
                }
              />
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  );
}
