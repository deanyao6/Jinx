import React, { useState } from 'react';
import { FlatList, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { TextField } from '@/components/TextField';
import { useDebounced } from '@/features/games/ui/useDebounced';
import { useMyStats, usePlayersSeen } from '@/features/passport/queries';
import { CountHero } from '@/features/passport/ui/CountHero';
import { PlayerRankRow } from '@/features/passport/ui/PlayerRankRow';
import { formatGameDate, sportLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

export default function PlayersSeenScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);
  const players = usePlayersSeen(debounced);
  const rows = players.data?.pages.flat() ?? [];
  // Already cached by the Passport tab. It carries the total, which a paged list cannot.
  const total = useMyStats().data?.players_seen ?? 0;
  // A search result has no places: third in "everyone named Harper" is not third overall.
  const ranked = debounced.trim().length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.screen }}>
      <FlatList
        data={rows}
        keyExtractor={(p) => p.player_id}
        contentContainerStyle={{
          paddingTop: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
        }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {total > 0 ? (
              <CountHero
                kicker="Most seen first"
                value={total.toLocaleString()}
                unit={total === 1 ? 'player seen' : 'players seen'}
              />
            ) : null}
            <TextField
              placeholder="Search players"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              accessibilityLabel="Search players"
            />
            {players.isPending ? <Loading /> : null}
            {players.isError ? (
              <ErrorNotice error={players.error} onRetry={players.refetch} />
            ) : null}
            {players.data && rows.length === 0 ? (
              <EmptyState
                icon={debounced.trim() ? 'i-search' : 'i-users'}
                title={debounced.trim() ? 'No players match' : 'No players yet'}
                body={
                  debounced.trim()
                    ? `Nobody named “${debounced.trim()}” in the games you attended.`
                    : 'Players appear once the games you attended have lineups.'
                }
              />
            ) : null}
          </>
        }
        renderItem={({ item, index }) => {
          const first = index === 0;
          const last = index === rows.length - 1;
          return (
            // One filled card drawn a row at a time, so the list can stay virtualised.
            <View
              style={{
                backgroundColor: c.card,
                paddingHorizontal: theme.spacing.lg,
                paddingTop: first ? 5 : 0,
                paddingBottom: last ? 5 : 0,
                borderTopLeftRadius: first ? theme.radius.lg : 0,
                borderTopRightRadius: first ? theme.radius.lg : 0,
                borderBottomLeftRadius: last ? theme.radius.lg : 0,
                borderBottomRightRadius: last ? theme.radius.lg : 0,
              }}
            >
              <PlayerRankRow
                rank={ranked ? index + 1 : null}
                accent={ranked && index < 3}
                name={item.full_name}
                subtitle={`${sportLabel(item.sport_id)}, last seen ${formatGameDate(item.last_seen, { withYear: true })}`}
                seen={item.seen}
              />
            </View>
          );
        }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (players.hasNextPage && !players.isFetchingNextPage) void players.fetchNextPage();
        }}
        ListFooterComponent={
          players.isFetchingNextPage ? (
            <Loading />
          ) : players.hasNextPage ? (
            <Button
              title="Load more"
              variant="ghost"
              small
              onPress={() => void players.fetchNextPage()}
              style={{ marginTop: theme.spacing.md }}
            />
          ) : null
        }
      />
    </View>
  );
}
