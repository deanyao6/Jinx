import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { useMyAttendances } from '@/features/attendances/queries';
import { isTodayAtVenue } from '@/features/checkin/lock';
import { useNearbyDayGames } from '@/features/checkin/queries';
import { useTicketImports } from '@/features/imports/queries';
import { importBadgeCount } from '@/features/imports/grouping';
import { useFavoriteTeams } from '@/features/profile/queries';
import { formatGameTime } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

/** Today banner (a logged or favorite-team game today at the venue) plus the imports inbox entry. */
export function TodayBanner() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const favorites = useFavoriteTeams();
  const attendances = useMyAttendances();
  const imports = useTicketImports();

  const favIds = useMemo(() => (favorites.data ?? []).map((t) => t.id), [favorites.data]);
  const [mountedAt] = useState(() => Date.now());
  const loggedNear = useMemo(() => {
    const day = 30 * 60 * 60 * 1000;
    return (attendances.data ?? [])
      .filter((a) => Math.abs(Date.parse(a.game.scheduled_start) - mountedAt) <= day)
      .map((a) => a.game_id);
  }, [attendances.data, mountedAt]);
  const games = useNearbyDayGames(favIds, loggedNear);

  const today = useMemo(
    () =>
      (games.data ?? []).filter(
        (g) =>
          g.status !== 'postponed' &&
          g.status !== 'cancelled' &&
          isTodayAtVenue(g.scheduled_start, g.venue?.tz),
      ),
    [games.data],
  );
  const badge = importBadgeCount(imports.data ?? []);

  return (
    <>
      {today.map((g) => (
        <Card key={g.id} style={{ backgroundColor: c.tint, borderColor: c.tint }}>
          <Text variant="label" color="muted" style={{ textTransform: 'uppercase' }}>
            Today
          </Text>
          <Text variant="h2" style={{ marginTop: 2 }}>
            {g.away?.name ?? 'Away'} at {g.home?.name ?? 'Home'}
          </Text>
          <Text variant="sub" color="muted">
            {formatGameTime(g.scheduled_start)}
            {g.venue ? ` · ${g.venue.name}` : ''}
          </Text>
          <View
            style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}
          >
            <Button
              title="Check in"
              onPress={() => router.push(`/games/checkin/${g.id}`)}
              style={{ flex: 1 }}
            />
            <Button title="Details" variant="ghost" onPress={() => router.push(`/games/${g.id}`)} />
          </View>
        </Card>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Imports${badge ? `, ${badge} waiting` : ''}`}
        onPress={() => router.push('/games/imports')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 10,
          paddingHorizontal: theme.spacing.md,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: theme.radius.md,
          backgroundColor: c.card,
          marginBottom: theme.spacing.md,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name="mail-open" size={18} color={c.ink} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Imports</Text>
          <Text variant="caption" color="muted">
            {badge
              ? `${badge} ticket${badge === 1 ? '' : 's'} waiting for you`
              : 'Uploaded and forwarded tickets'}
          </Text>
        </View>
        {badge ? (
          <View
            style={{
              minWidth: 22,
              height: 22,
              borderRadius: 11,
              paddingHorizontal: 6,
              backgroundColor: c.red,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="label" color="onInk">
              {badge}
            </Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={c.muted} />
      </Pressable>
    </>
  );
}
