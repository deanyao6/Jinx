import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useGhostVenues } from '@/features/bucketlists/queries';
import { stampNumber, visitsLabel } from '@/features/passport/format';
import { useMyStats } from '@/features/passport/queries';
import type { StatsStamp } from '@/features/passport/types';
import { Sheet, StampsGrid, VenueSheet, type GhostVenue } from '@/features/passport/ui';
import { sportLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

export default function StampsScreen() {
  const theme = useTheme();
  const stats = useMyStats();
  const [sport, setSport] = useState<string | null>(null);
  const [venue, setVenue] = useState<StatsStamp | null>(null);
  const [ghost, setGhost] = useState<GhostVenue | null>(null);

  const stamps = useMemo(() => stats.data?.stamps ?? [], [stats.data]);
  const visitedIds = useMemo(() => stamps.map((s) => s.venue_id), [stamps]);
  const { ghosts } = useGhostVenues(visitedIds);

  const sports = useMemo(
    () => Array.from(new Set(stamps.flatMap((s) => s.sports))).sort(),
    [stamps],
  );
  const filtered = sport ? stamps.filter((s) => s.sports.includes(sport)) : stamps;
  const visits = filtered.reduce((n, s) => n + s.visits, 0);
  const closed = filtered.filter((s) => s.closed).length;

  return (
    <Screen>
      {stats.isPending ? <Loading /> : null}
      {stats.isError ? <ErrorNotice error={stats.error} onRetry={stats.refetch} /> : null}
      {sports.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.sm }}>
          <Chip label="All" selected={sport === null} onPress={() => setSport(null)} />
          {sports.map((sp) => (
            <Chip
              key={sp}
              label={sportLabel(sp)}
              selected={sport === sp}
              onPress={() => setSport(sp)}
            />
          ))}
        </View>
      ) : null}
      {stats.data && stamps.length === 0 ? (
        <EmptyState
          title="No stamps yet"
          body="Each venue you attend a game at becomes a stamp with its visit count."
        />
      ) : null}
      {filtered.length > 0 ? (
        <Card>
          <Text variant="caption" color="muted" style={{ marginBottom: 6 }}>
            {filtered.length} {filtered.length === 1 ? 'stadium' : 'stadiums'},{' '}
            {visitsLabel(visits)}
            {closed ? `, ${closed} closed` : ''}
          </Text>
          <StampsGrid
            stamps={filtered}
            ghosts={sport ? [] : ghosts}
            onPressStamp={setVenue}
            onPressGhost={setGhost}
          />
        </Card>
      ) : null}
      {!sport && ghosts.length > 0 ? (
        <Text variant="caption" color="muted">
          Dashed stamps are venues on your bucket lists you have not visited yet.
        </Text>
      ) : null}
      <VenueSheet
        stamp={venue}
        stampNumber={venue ? stampNumber(stamps, venue.venue_id) : null}
        onClose={() => setVenue(null)}
      />
      <Sheet
        visible={!!ghost}
        title={ghost?.name ?? ''}
        subtitle="On your list"
        onClose={() => setGhost(null)}
      >
        <Text color="muted">
          You have not logged a game here yet. Attend one and this ghost becomes a real stamp.
        </Text>
      </Sheet>
    </Screen>
  );
}
