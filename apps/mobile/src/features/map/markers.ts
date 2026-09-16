/** Pure helpers for the map screen: marker models, sizing, and region fitting. */
import type { GoalGame } from '@appname/core';

import type { VenueLite } from '@/features/bucketlists/queries';
import type { StatsStamp } from '@/features/passport/types';

export type LatLng = { latitude: number; longitude: number };

export type VenueMarker = {
  id: string;
  name: string;
  coordinate: LatLng;
  visits: number;
  ghost: boolean;
  closed: boolean;
  stamp?: StatsStamp;
};

export type MapFilters = { sport: string | null; franchiseId: string | null };

/** Venue ids that pass the sport / team filters, derived from the user's games. */
export function venueIdsMatching(games: GoalGame[], filters: MapFilters): Set<string> | null {
  if (!filters.sport && !filters.franchiseId) return null;
  const ids = new Set<string>();
  for (const g of games) {
    if (!g.venueId) continue;
    if (filters.sport && g.sport !== filters.sport) continue;
    if (
      filters.franchiseId &&
      g.homeFranchiseId !== filters.franchiseId &&
      g.awayFranchiseId !== filters.franchiseId
    ) {
      continue;
    }
    ids.add(g.venueId);
  }
  return ids;
}

export function buildMarkers(
  stamps: StatsStamp[],
  ghosts: VenueLite[],
  games: GoalGame[],
  filters: MapFilters,
): VenueMarker[] {
  const allowed = venueIdsMatching(games, filters);
  const markers: VenueMarker[] = [];
  for (const s of stamps) {
    if (s.lat == null || s.lng == null) continue;
    if (allowed) {
      if (!allowed.has(s.venue_id)) continue;
    } else if (filters.sport && !s.sports.includes(filters.sport)) {
      continue;
    }
    markers.push({
      id: s.venue_id,
      name: s.name,
      coordinate: { latitude: s.lat, longitude: s.lng },
      visits: s.visits,
      ghost: false,
      closed: s.closed,
      stamp: s,
    });
  }
  // Ghost markers hide under a team filter (they are about places, not teams).
  if (!filters.franchiseId) {
    const seen = new Set(markers.map((m) => m.id));
    for (const v of ghosts) {
      if (v.lat == null || v.lng == null || seen.has(v.id)) continue;
      markers.push({
        id: v.id,
        name: v.name,
        coordinate: { latitude: v.lat, longitude: v.lng },
        visits: 0,
        ghost: true,
        closed: v.closed_year != null,
      });
    }
  }
  return markers;
}

/** Marker diameter grows with visits: 28pt for one visit up to 52pt. */
export function markerSize(visits: number): number {
  if (visits <= 0) return 22;
  return Math.min(52, 28 + Math.round(Math.log2(visits) * 8));
}

export type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };

const USA: Region = { latitude: 39.5, longitude: -96.5, latitudeDelta: 32, longitudeDelta: 46 };

/** Region containing every coordinate with padding; the continental US when there are none. */
export function regionFor(points: LatLng[]): Region {
  if (points.length === 0) return USA;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }
  const latDelta = Math.max(0.5, (maxLat - minLat) * 1.4);
  const lngDelta = Math.max(0.5, (maxLng - minLng) * 1.4);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}
