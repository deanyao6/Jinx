import * as Location from 'expo-location';

import { distanceMeters } from './lock';

export type LocationOutcome =
  | { ok: true; distanceM: number; accuracyM: number }
  | { ok: false; reason: 'permission_denied' | 'location_unavailable' };

/**
 * Asks for foreground location (only when the user taps Check in) and returns the distance to the
 * venue. Coordinates never leave the device; only distance and accuracy are sent (SPEC.md 6.3).
 */
export async function measureDistanceToVenue(venue: {
  lat: number;
  lng: number;
}): Promise<LocationOutcome> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') return { ok: false, reason: 'permission_denied' };
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const distanceM = distanceMeters(
      pos.coords.latitude,
      pos.coords.longitude,
      venue.lat,
      venue.lng,
    );
    return { ok: true, distanceM, accuracyM: Math.max(0, pos.coords.accuracy ?? 0) };
  } catch {
    return { ok: false, reason: 'location_unavailable' };
  }
}
