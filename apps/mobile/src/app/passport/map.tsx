import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { Chip } from '@/components/Chip';
import { Loading } from '@/components/Loading';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Text } from '@/components/Text';
import { useGhostVenues } from '@/features/bucketlists/queries';
import { useGoalGames } from '@/features/goals/queries';
import { buildMarkers, markerSize, regionFor, type VenueMarker } from '@/features/map/markers';
import { stampNumber } from '@/features/passport/format';
import { useMyStats } from '@/features/passport/queries';
import type { StatsStamp } from '@/features/passport/types';
import { VenueSheet } from '@/features/passport/ui';
import { useFavoriteTeams, useProfile } from '@/features/profile/queries';
import { sportLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

function VenuePin({ marker, dark }: { marker: VenueMarker; dark: boolean }) {
  const theme = useTheme();
  const c = theme.colors;
  const size = markerSize(marker.visits);
  const color = marker.ghost ? c.muted : marker.closed ? c.muted : c.red;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: marker.ghost ? (dark ? '#00000066' : '#FFFFFFAA') : color,
        borderWidth: 2,
        borderColor: marker.ghost ? c.muted : dark ? c.ink : '#FFFFFF',
        borderStyle: marker.ghost ? 'dashed' : 'solid',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: marker.closed && !marker.ghost ? 0.7 : 1,
      }}
    >
      {!marker.ghost ? (
        <Text
          style={{
            fontSize: size >= 36 ? 13 : 11,
            lineHeight: 15,
            fontWeight: '800',
            color: '#FFFFFF',
          }}
        >
          {marker.visits}
        </Text>
      ) : null}
    </View>
  );
}

export default function MapScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const stats = useMyStats();
  const games = useGoalGames();
  const profile = useProfile();
  const favorites = useFavoriteTeams();
  const mapRef = useRef<MapView>(null);

  const [sport, setSport] = useState<string | null>(null);
  const [franchiseId, setFranchiseId] = useState<string | null>(null);
  const [lines, setLines] = useState(false);
  const [venue, setVenue] = useState<StatsStamp | null>(null);

  const stamps = useMemo(() => stats.data?.stamps ?? [], [stats.data]);
  const visitedIds = useMemo(() => stamps.map((s) => s.venue_id), [stamps]);
  const { ghosts } = useGhostVenues(visitedIds);

  const markers = useMemo(
    () => buildMarkers(stamps, ghosts, games.data ?? [], { sport, franchiseId }),
    [stamps, ghosts, games.data, sport, franchiseId],
  );
  const initialRegion = useMemo(
    () =>
      regionFor(
        stamps.flatMap((s) =>
          s.lat != null && s.lng != null ? [{ latitude: s.lat, longitude: s.lng }] : [],
        ),
      ),
    [stamps],
  );

  const homeLat = profile.data?.home_lat ?? null;
  const homeLng = profile.data?.home_lng ?? null;
  const home = useMemo(
    () => (homeLat != null && homeLng != null ? { latitude: homeLat, longitude: homeLng } : null),
    [homeLat, homeLng],
  );

  const sports = useMemo(
    () => Array.from(new Set(stamps.flatMap((s) => s.sports))).sort(),
    [stamps],
  );
  const teamChips = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of favorites.data ?? []) {
      if (!seen.has(t.franchise_id)) seen.set(t.franchise_id, t.name);
    }
    return Array.from(seen.entries());
  }, [favorites.data]);

  useEffect(() => {
    if (markers.length === 0) return;
    const coords = markers.map((m) => m.coordinate);
    if (lines && home) coords.push(home);
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
      animated: true,
    });
  }, [markers, lines, home]);

  const byId = useMemo(() => new Map(stamps.map((s) => [s.venue_id, s])), [stamps]);

  return (
    <View style={{ flex: 1, backgroundColor: c.screen }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Chip
            label="All"
            selected={sport === null && franchiseId === null}
            onPress={() => {
              setSport(null);
              setFranchiseId(null);
            }}
          />
          {sports.map((sp) => (
            <Chip
              key={sp}
              label={sportLabel(sp)}
              selected={sport === sp}
              onPress={() => setSport(sport === sp ? null : sp)}
            />
          ))}
          {teamChips.map(([id, name]) => (
            <Chip
              key={id}
              label={name}
              selected={franchiseId === id}
              onPress={() => setFranchiseId(franchiseId === id ? null : id)}
            />
          ))}
          {home ? (
            <Chip
              label="Lines from home"
              accent="green"
              selected={lines}
              onPress={() => setLines((v) => !v)}
            />
          ) : null}
        </ScrollView>
        {stats.isError ? <ErrorNotice error={stats.error} onRetry={stats.refetch} /> : null}
      </View>
      <View
        style={{
          flex: 1,
          margin: theme.spacing.lg,
          marginTop: theme.spacing.sm,
          borderRadius: theme.radius.lg,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: c.line,
        }}
      >
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          userInterfaceStyle={theme.scheme}
          showsPointsOfInterests={false}
          accessibilityLabel="Map of stadiums you have visited"
        >
          {lines && home
            ? markers
                .filter((m) => !m.ghost)
                .map((m) => (
                  <Polyline
                    key={`line-${m.id}`}
                    coordinates={[home, m.coordinate]}
                    strokeColor={c.blue}
                    strokeWidth={1.5}
                    geodesic
                  />
                ))
            : null}
          {lines && home ? (
            <Marker
              coordinate={home}
              title="Home"
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: c.blue,
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                }}
              />
            </Marker>
          ) : null}
          {markers.map((m) => (
            <Marker
              key={m.id}
              coordinate={m.coordinate}
              title={m.name}
              description={
                m.ghost ? 'On your list' : `${m.visits} ${m.visits === 1 ? 'visit' : 'visits'}`
              }
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={() => {
                const stamp = byId.get(m.id);
                if (stamp) setVenue(stamp);
              }}
            >
              <VenuePin marker={m} dark={theme.scheme === 'dark'} />
            </Marker>
          ))}
        </MapView>
        {stats.isPending ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <Loading />
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <Text variant="caption" color="muted">
          {markers.filter((m) => !m.ghost).length} visited, {markers.filter((m) => m.ghost).length}{' '}
          on your lists. Bigger pins mean more visits; dashed pins are bucket-list venues.
        </Text>
      </View>
      <VenueSheet
        stamp={venue}
        stampNumber={venue ? stampNumber(stamps, venue.venue_id) : null}
        onClose={() => setVenue(null)}
      />
    </View>
  );
}
