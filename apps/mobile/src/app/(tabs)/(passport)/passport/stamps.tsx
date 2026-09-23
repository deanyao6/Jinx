import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { venueNounFor } from '@jinx/core';

import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { StatTile } from '@/components/StatTile';
import { Text } from '@/components/Text';
import { useGhostVenues } from '@/features/bucketlists/queries';
import { stampNumber } from '@/features/passport/format';
import { useMyStats } from '@/features/passport/queries';
import type { StatsStamp } from '@/features/passport/types';
import { Sheet, VenueSheet, stampCells, type GhostVenue } from '@/features/passport/ui';
import { CountHero } from '@/features/passport/ui/CountHero';
import { SealGrid } from '@/features/passport/ui/SealGrid';
import { useVenueShapes } from '@/features/venues/shapes';
import { sportLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

function distinct(values: (string | null)[]): number {
  return new Set(values.filter((v): v is string => !!v)).size;
}

export default function StampsScreen() {
  const theme = useTheme();
  const stats = useMyStats();
  // The same cached `venue_shapes` read the Passport tab draws its seals from.
  const venueShapes = useVenueShapes();
  const [sport, setSport] = useState<string | null>(null);
  const [venue, setVenue] = useState<StatsStamp | null>(null);
  const [ghost, setGhost] = useState<GhostVenue | null>(null);

  const stamps = useMemo(() => stats.data?.stamps ?? [], [stats.data]);
  const visitedIds = useMemo(() => stamps.map((s) => s.venue_id), [stamps]);
  const { ghosts } = useGhostVenues(visitedIds);
  const shapes = useMemo(
    () => new Map((venueShapes.data ?? []).map((row) => [row.venue_id, row.shape_key as string])),
    [venueShapes.data],
  );

  const sports = useMemo(
    () => Array.from(new Set(stamps.flatMap((s) => s.sports))).sort(),
    [stamps],
  );
  const filtered = useMemo(
    () => (sport ? stamps.filter((s) => s.sports.includes(sport)) : stamps),
    [sport, stamps],
  );
  const visits = filtered.reduce((n, s) => n + s.visits, 0);
  const closed = filtered.filter((s) => s.closed).length;
  const states = distinct(filtered.map((s) => s.state));
  const cities = distinct(filtered.map((s) => [s.city, s.state].filter(Boolean).join(', ')));

  // The sport's own word only when every venue on screen is one sport and nothing else:
  // "ballparks", "stadiums", "arenas"; a mixed set is "venues" (VENUE_NOUN in packages/core).
  const sportsOnScreen = filtered.flatMap((s) => (s.sports.length > 0 ? s.sports : ['?']));
  const one = venueNounFor(sportsOnScreen);
  const many = venueNounFor(sportsOnScreen, true);

  const cells = useMemo(() => stampCells(filtered, sport ? [] : ghosts), [filtered, sport, ghosts]);
  const visitedCells = cells.filter((cell) => cell.stamp);
  const ghostCells = cells.filter((cell) => cell.ghost);

  return (
    <Screen>
      {stats.isPending ? <Loading /> : null}
      {stats.isError ? <ErrorNotice error={stats.error} onRetry={stats.refetch} /> : null}
      {filtered.length > 0 ? (
        <>
          <CountHero
            kicker={sport ? `${sportLabel(sport)} stamps` : 'Your stamps'}
            value={String(filtered.length)}
            unit={filtered.length === 1 ? one : many}
            body={
              closed
                ? `${closed} of them ${closed === 1 ? 'has' : 'have'} closed since you went.`
                : null
            }
          />
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: theme.spacing.lg }}>
            <StatTile label="Visits" value={String(visits)} />
            <StatTile label={states === 1 ? 'State' : 'States'} value={String(states)} />
            <StatTile label={cities === 1 ? 'City' : 'Cities'} value={String(cities)} />
          </View>
        </>
      ) : null}
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
          icon="i-passport"
          title="No stamps yet"
          body="Each venue you attend a game at becomes a stamp with its visit count."
        />
      ) : null}
      {visitedCells.length > 0 ? (
        <View style={{ marginBottom: theme.spacing.xl }}>
          <SectionHeader title="Collected" />
          <SealGrid
            cells={visitedCells}
            shapes={shapes}
            onPressCell={(cell) => (cell.stamp ? setVenue(cell.stamp) : undefined)}
          />
        </View>
      ) : null}
      {filtered.length > 0 && ghostCells.length > 0 ? (
        <View style={{ marginBottom: theme.spacing.xl }}>
          <SectionHeader title="Still to collect" />
          <Text variant="sub" color="muted" style={{ marginBottom: theme.spacing.md }}>
            Dashed stamps are venues on your bucket lists you have not visited yet.
          </Text>
          <SealGrid
            cells={ghostCells}
            shapes={shapes}
            onPressCell={(cell) => (cell.ghost ? setGhost(cell.ghost) : undefined)}
          />
        </View>
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
