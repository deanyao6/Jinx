import { useQuery } from '@tanstack/react-query';

import type { ShapeKey } from '@/features/data/shapes';
import { supabase } from '@/lib/supabase';

/**
 * Venue outlines from `venue_shapes` (SPEC.md 8.5).
 *
 * v1 stores the reference's placeholder shape key per venue; a later pass traces real
 * OpenStreetMap footprints into `svg_path`. Only the key is read here, because that is
 * what the SVG components draw today.
 */
export type VenueShape = { venue_id: string; shape_key: ShapeKey };

export const venueShapeKeys = { all: ['venue-shapes'] as const };

export function useVenueShapes() {
  return useQuery({
    queryKey: venueShapeKeys.all,
    queryFn: async (): Promise<VenueShape[]> => {
      const { data, error } = await supabase.from('venue_shapes').select('venue_id, shape_key');
      if (error) throw error;
      return data as VenueShape[];
    },
    staleTime: 24 * 60 * 60_000,
  });
}

/**
 * The shape to draw for a venue that has no `venue_shapes` row.
 *
 * The fallback used to be a flat `'ballparkA'`, which is what made a football stadium
 * render as a baseball diamond: the table shipped empty, so *every* venue took it. The
 * per-venue shapes are seeded now, but a fallback that ignores the sport is still wrong
 * for any venue added before the seed catches up, so it picks the family instead.
 *
 * `sports` is whatever the caller knows: a stamp's list of sports played at the venue, or
 * a single game's sport id.
 */
export function defaultShapeKey(sports: readonly string[]): ShapeKey {
  if (sports.includes('mlb')) return 'ballparkA';
  if (sports.length > 0 && sports.every((s) => s === 'nba')) return 'arena';
  if (sports.includes('mls') && !sports.includes('mlb')) return 'bowl';
  return 'bowl';
}
