import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { PageIntro } from '@/components/PageIntro';
import { ICONS } from '@/components/reference/icons';
import { Segmented } from '@/components/Segmented';
import type { FeedSegment } from '@/features/feed/types';
import { DiscoverPeople } from '@/features/feed/ui/DiscoverPeople';
import { FeedList } from '@/features/feed/ui/FeedList';
import { PendingTags } from '@/features/feed/ui/PendingTags';
import { useTheme } from '@/theme/ThemeProvider';

const SEGMENTS: { key: FeedSegment; label: string }[] = [
  { key: 'following', label: 'Following' },
  { key: 'discover', label: 'Discover' },
];

/**
 * The Feed tab (social brief 02, section 2). Following is the people you follow and you,
 * newest first; Discover is creators, communities and fans at your games. `?tab=` is the
 * segment, rewritten in place, so switching never adds a back step.
 */
export default function FeedRoute() {
  const theme = useTheme();
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const current: FeedSegment = tab === 'discover' ? 'discover' : 'following';
  const Search = ICONS['i-search'];

  const header = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <PageIntro title="Feed" />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Find communities"
          hitSlop={8}
          onPress={() => router.push('/communities')}
          style={{ paddingTop: 6 }}
        >
          <Search color={theme.colors.ink} />
        </Pressable>
      </View>
      <Segmented options={SEGMENTS} value={current} onChange={(next) => router.setParams({ tab: next })} />
      <View style={{ height: theme.spacing.md }} />
      {current === 'following' ? <PendingTags /> : <DiscoverPeople />}
    </View>
  );

  const empty =
    current === 'following' ? (
      <View style={{ gap: theme.spacing.sm }}>
        <EmptyState
          icon="i-users"
          title="Your feed is quiet"
          body="Follow people you go to games with and their games show up here, with kudos and comments."
        />
        <Button title="Find people" onPress={() => router.push('/friends/find')} />
        <Button title="Import contacts" variant="secondary" onPress={() => router.push('/friends/contacts')} />
        <Button title="Join a community" variant="secondary" onPress={() => router.push('/communities')} />
      </View>
    ) : (
      <EmptyState
        icon="i-search"
        title="Nothing to discover yet"
        body="Posts from superfans about your teams and from your communities show up here."
      />
    );

  // A key per segment: each keeps its own scroll position and pages.
  return <FeedList key={current} segment={current} header={header} empty={empty} />;
}
