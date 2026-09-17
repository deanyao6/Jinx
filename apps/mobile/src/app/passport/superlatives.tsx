import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { superlativeRows, type SuperlativeRow } from '@/features/passport/format';
import { useGamesByIds, useMyStats } from '@/features/passport/queries';
import type { StatsStamp } from '@/features/passport/types';
import { SuperlativesList, VenueSheet } from '@/features/passport/ui';
import { formatGameDate } from '@/lib/format';

export default function SuperlativesScreen() {
  const router = useRouter();
  const stats = useMyStats();
  const [venue, setVenue] = useState<StatsStamp | null>(null);
  const s = stats.data;
  const rows = useMemo(() => (s ? superlativeRows(s.superlatives, s.moments, s.streaks) : []), [s]);
  const gameIds = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => (r.gameId ? [r.gameId] : [])))),
    [rows],
  );
  const games = useGamesByIds(gameIds);

  const subtitleFor = (row: SuperlativeRow): string | null => {
    if (!row.gameId) return null;
    const g = games.data?.get(row.gameId);
    if (!g) return null;
    return `${g.away?.name ?? 'Away'} at ${g.home?.name ?? 'Home'}, ${formatGameDate(g.scheduled_start, { withYear: true })}`;
  };

  const onPressRow = (row: SuperlativeRow) => {
    if (row.gameId) router.push(`/games/${row.gameId}`);
    else if (row.venueId) setVenue(s?.stamps.find((st) => st.venue_id === row.venueId) ?? null);
    else if (row.playerId) router.push('/passport/players');
  };

  return (
    <Screen>
      {stats.isPending ? <Loading /> : null}
      {stats.isError ? <ErrorNotice error={stats.error} onRetry={stats.refetch} /> : null}
      {s && rows.length === 0 ? (
        <EmptyState
          title="Nothing to brag about yet"
          body="Coldest game, longest game, biggest comeback and more appear once your attended games have details."
        />
      ) : null}
      {rows.length > 0 ? (
        <Card>
          <SuperlativesList rows={rows} subtitleFor={subtitleFor} onPressRow={onPressRow} />
        </Card>
      ) : null}
      {rows.length > 0 ? (
        <Text variant="caption" color="muted">
          Games without weather or timing data are skipped. Rows with a game open its detail page.
        </Text>
      ) : null}
      {/* The only way into these two. They hung off the old Passport tab, and the reference
          Passport has no row for them, so without this Moments witnessed was unreachable. */}
      <Card label="More from your games">
        <Row
          title="Moments witnessed"
          subtitle="Walk-offs, no-hitters, pick sixes, comebacks"
          first
          chevron
          onPress={() => router.push('/passport/moments')}
        />
        <Row
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
