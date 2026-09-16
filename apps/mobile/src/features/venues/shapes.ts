import { useQuery } from '@tanstack/react-query';

import type { ShapeKey } from '@/features/data/shapes';
import { supabase } from '@/lib/supabase';

/**
 * Stadium outlines from `venue_shapes` (SPEC.md 8.5).
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
