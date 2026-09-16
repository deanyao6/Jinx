import React, { useState } from 'react';
import { FlatList, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Row } from '@/components/Row';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useDebounced } from '@/features/games/ui/useDebounced';
import { usePlayersSeen } from '@/features/passport/queries';
import { formatGameDate, sportLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

export default function PlayersSeenScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);
  const players = usePlayersSeen(debounced);
  const rows = players.data?.pages.flat() ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: c.screen }}>
      <FlatList
        data={rows}
        keyExtractor={(p) => p.player_id}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
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
        renderItem={({ item, index }) => (
          <View
            style={{
              backgroundColor: c.card,
              paddingHorizontal: theme.spacing.md,
              borderColor: c.line,
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderTopWidth: index === 0 ? 1 : 0,
              borderBottomWidth: index === rows.length - 1 ? 1 : 0,
              borderTopLeftRadius: index === 0 ? theme.radius.lg : 0,
              borderTopRightRadius: index === 0 ? theme.radius.lg : 0,
              borderBottomLeftRadius: index === rows.length - 1 ? theme.radius.lg : 0,
              borderBottomRightRadius: index === rows.length - 1 ? theme.radius.lg : 0,
            }}
          >
            <Row
              first={index === 0}
              title={item.full_name}
              subtitle={`${sportLabel(item.sport_id)}, last seen ${formatGameDate(item.last_seen, { withYear: true })}`}
              right={
                <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                  {item.seen} {item.seen === 1 ? 'time' : 'times'}
                </Text>
              }
            />
          </View>
        )}
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
