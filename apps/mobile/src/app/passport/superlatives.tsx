import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { superlativeRows, type SuperlativeRow } from '@/features/passport/format';
import { useGamesByIds, useMyStats } from '@/features/passport/queries';
import type { StatsStamp } from '@/features/passport/types';
import { VenueSheet } from '@/features/passport/ui';
import { CountHero } from '@/features/passport/ui/CountHero';
import { SuperlativeCards, type SuperlativeContext } from '@/features/passport/ui/SuperlativeCards';
import { formatGameDate } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

export default function SuperlativesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const stats = useMyStats();
  const [venue, setVenue] = useState<StatsStamp | null>(null);
  const s = stats.data;
  const rows = useMemo(() => (s ? superlativeRows(s.superlatives, s.moments, s.streaks) : []), [s]);
  const gameIds = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => (r.gameId ? [r.gameId] : [])))),
    [rows],
  );
  const games = useGamesByIds(gameIds);

  // The game a row points at: its date on the chip, its matchup under the value. A row about a
  // stadium says which one instead.
  const contextFor = (row: SuperlativeRow): SuperlativeContext | null => {
    const g = row.gameId ? games.data?.get(row.gameId) : undefined;
    if (row.venueId) {
      return {
        chip: g ? formatGameDate(g.scheduled_start, { withYear: true }) : null,
        detail: row.context ?? null,
      };
    }
    if (!g) return null;
    return {
      // "First game" already has the date as its value.
      chip: row.key === 'first_game' ? null : formatGameDate(g.scheduled_start, { withYear: true }),
      detail: `${g.away?.name ?? 'Away'} at ${g.home?.name ?? 'Home'}`,
    };
  };

  const onPressRow = (row: SuperlativeRow) => {
    const stamp = row.venueId ? s?.stamps.find((st) => st.venue_id === row.venueId) : undefined;
    // A player opens the games you saw them in. The stadium you visit most opens its sheet, which
    // lists every game there; any other row opens the one game its number is from.
    if (row.playerId) router.push(`/passport/player/${row.playerId}`);
    else if (row.key === 'most_visited_venue' && stamp) setVenue(stamp);
    else if (row.gameId) router.push(`/games/${row.gameId}`);
    else if (stamp) setVenue(stamp);
  };

  return (
    <Screen>
      {stats.isPending ? <Loading /> : null}
      {stats.isError ? <ErrorNotice error={stats.error} onRetry={stats.refetch} /> : null}
      {s && rows.length === 0 ? (
        <EmptyState
          icon="i-spark"
          title="Nothing to brag about yet"
          body="Coldest game, largest crowd, biggest comeback and more appear once your attended games have details."
        />
      ) : null}
      {s && rows.length > 0 ? (
        <CountHero
          kicker={`From ${s.totals.games} ${s.totals.games === 1 ? 'game' : 'games'}`}
          value={String(rows.length)}
          unit={rows.length === 1 ? 'superlative' : 'superlatives'}
        />
      ) : null}
      {rows.length > 0 ? (
        <SuperlativeCards rows={rows} contextFor={contextFor} onPressRow={onPressRow} />
      ) : null}
      {rows.length > 0 ? (
        <Text
          variant="caption"
          color="muted"
          style={{ marginTop: theme.spacing.xs, marginBottom: theme.spacing.lg }}
        >
          Games without weather, timing or crowd data are skipped. A row opens the game its number
          is from.
        </Text>
      ) : null}
      {/* The only way into these two. They hung off the old Passport tab, and the reference
          Passport has no row for them, so without this Moments witnessed was unreachable. */}
      <SectionHeader title="More from your games" />
      <Card style={{ paddingVertical: theme.spacing.xs + 2 }}>
        <Row
          icon="i-bolt"
          title="Moments witnessed"
          subtitle="Walk-offs, no-hitters, pick sixes, comebacks"
          first
          chevron
          onPress={() => router.push('/passport/moments')}
        />
        <Row
          icon="i-users"
          title="Players seen"
          subtitle="Everyone who appeared in a game you attended"
          chevron
          onPress={() => router.push('/passport/players')}
        />
      </Card>
      <VenueSheet stamp={venue} onClose={() => setVenue(null)} />
    </Screen>
  );
}
