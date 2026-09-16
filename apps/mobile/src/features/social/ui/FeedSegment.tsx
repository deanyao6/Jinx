import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import type { FeedEvent } from '../copy';
import { useFeed, useReact } from '../queries';
import { FeedEventCard } from './FeedEventCard';

type Props = { header?: React.ReactNode; onFindPeople: () => void };

/** Infinite feed of followed users' events. Owns its scrolling (FlatList). */
export function FeedSegment({ header, onFindPeople }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const feed = useFeed();
  const react = useReact();

  const events = useMemo(() => feed.data?.pages.flat() ?? [], [feed.data]);

  const open = (e: FeedEvent) => {
    if (e.game_id) router.push(`/games/${e.game_id}`);
    else router.push(`/u/${e.actor_handle}`);
  };

  return (
    <FlatList
      data={events}
      keyExtractor={(e) => e.id}
      renderItem={({ item }) => (
        <FeedEventCard
          event={item}
          onOpen={() => open(item)}
          onOpenActor={() => router.push(`/u/${item.actor_handle}`)}
          onReact={(emoji) => react.mutate({ event: item, emoji })}
        />
      )}
      ListHeaderComponent={
        <>
          {header}
          {feed.isError ? <ErrorNotice error={feed.error} onRetry={feed.refetch} /> : null}
          {react.isError ? <ErrorNotice error={react.error} /> : null}
        </>
      }
      ListEmptyComponent={
        feed.isPending ? (
          <Loading label="Loading your feed" />
        ) : feed.isError ? null : (
          <EmptyState
            title="Nothing here yet"
            body="Follow people you go to games with and their games, pledges, and stamps show up here."
            actionTitle="Find people"
            onAction={onFindPeople}
          />
        )
      }
      ListFooterComponent={
        feed.isFetchingNextPage ? (
          <Loading />
        ) : events.length && !feed.hasNextPage ? (
          <Text variant="caption" color="muted" align="center" style={{ paddingVertical: 12 }}>
            That’s everything.
          </Text>
        ) : (
          <View style={{ height: theme.spacing.xl }} />
        )
      }
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl
          refreshing={feed.isRefetching && !feed.isFetchingNextPage}
          onRefresh={() => feed.refetch()}
          tintColor={theme.colors.muted}
        />
      }
      contentContainerStyle={{
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing.xl,
      }}
      keyboardShouldPersistTaps="handled"
    />
  );
}
