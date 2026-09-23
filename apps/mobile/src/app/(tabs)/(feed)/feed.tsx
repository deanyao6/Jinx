import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { PageIntro } from '@/components/PageIntro';
import { ICONS } from '@/components/reference/icons';
import { Segmented } from '@/components/Segmented';
import { RoutePlaceholder } from '@/features/navigation/ui/RoutePlaceholder';
import { useTheme } from '@/theme/ThemeProvider';

type FeedSegment = 'following' | 'discover';

const SEGMENTS: { key: FeedSegment; label: string }[] = [
  { key: 'following', label: 'Following' },
  { key: 'discover', label: 'Discover' },
];

const COPY: Record<FeedSegment, { title: string; body: string }> = {
  following: {
    title: 'Your feed is coming',
    body: 'Games the people you follow log will show up here, with kudos and comments.',
  },
  discover: {
    title: 'Discover is coming',
    body: 'Fans at your games, communities and creators will show up here.',
  },
};

/**
 * The Feed tab root, a placeholder until prompt 2 builds the feed. `?tab=following|discover`
 * is the segment, rewritten in place so switching never adds a back step.
 */
export default function FeedRoute() {
  const theme = useTheme();
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const current: FeedSegment = tab === 'discover' ? 'discover' : 'following';
  const Search = ICONS['i-search'];
  return (
    <RoutePlaceholder
      icon="i-news"
      title={COPY[current].title}
      body={COPY[current].body}
      links={[{ label: 'Communities', href: '/communities' }]}
    >
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
      <Segmented
        options={SEGMENTS}
        value={current}
        onChange={(next) => router.setParams({ tab: next })}
      />
    </RoutePlaceholder>
  );
}
