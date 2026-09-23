import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorNotice } from '@/components/ErrorNotice';
import { useIsUnderHeader } from '@/components/subPageHeader';
import { useFeed } from '@/features/feed/queries';
import type { FeedSegment, Post } from '@/features/feed/types';
import { useTheme } from '@/theme/ThemeProvider';
import { PostCard } from './PostCard';
import { usePostActions } from './usePostActions';

/**
 * One segment of the feed: newest first, paged by (published_at, id) so a post arriving at
 * the top never shifts what is loaded below. Pull to refresh brings the new ones in.
 */
export function FeedList({
  segment,
  header,
  empty,
}: {
  segment: FeedSegment;
  header: React.ReactElement;
  empty: React.ReactElement;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const headed = useIsUnderHeader();
  const feed = useFeed(segment);
  const actions = usePostActions();
  const posts = useMemo(() => {
    // A post can straddle two pages only if the server's order moved; never draw it twice.
    const seen = new Set<string>();
    const out: Post[] = [];
    for (const page of feed.data?.pages ?? []) {
      for (const p of page) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        out.push(p);
      }
    }
    return out;
  }, [feed.data]);

  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.id}
      style={{ flex: 1, backgroundColor: theme.colors.screen }}
      contentContainerStyle={{
        paddingTop: (headed ? 0 : insets.top) + theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: 48,
        gap: 12,
      }}
      ListHeaderComponent={header}
      ListEmptyComponent={
        feed.isPending ? (
          <ActivityIndicator style={{ marginTop: 32 }} />
        ) : feed.isError ? (
          <ErrorNotice error={feed.error} onRetry={feed.refetch} />
        ) : (
          empty
        )
      }
      ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} /> : <View />}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          meId={actions.meId}
          onOpen={() => actions.open(item)}
          onOpenAuthor={() => actions.openAuthor(item)}
          onKudos={() => actions.toggleKudos(item)}
          onComments={() => actions.comments(item)}
          onMore={() => actions.more(item)}
        />
      )}
      onEndReachedThreshold={0.6}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => void feed.refetch()} />
      }
    />
  );
}
