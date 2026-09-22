import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store';
import { passportKeys } from '@/features/passport/queries';
import { supabase } from '@/lib/supabase';
import { parseWrapped } from './parse';
import type { WrappedSeason } from './seasons';
import type { WrappedPayload } from './types';

export { currentSeasonFor, isPreviewSeason, seasonOptions, type WrappedSeason } from './seasons';

export const wrappedKeys = {
  all: ['wrapped'] as const,
  seasons: (userId: string | null) => ['wrapped', 'seasons', userId] as const,
  payload: (userId: string | null, sport: string, season: number) =>
    ['wrapped', 'payload', userId, sport, season] as const,
};

export function useWrappedSeasons() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: wrappedKeys.seasons(userId),
    queryFn: async (): Promise<WrappedSeason[]> => {
      const { data, error } = await supabase
        .from('wrapped_snapshots')
        .select('sport_id, season, generated_at')
        .eq('user_id', userId as string)
        .order('season', { ascending: false });
      if (error) throw error;
      return data.filter((s) => s.sport_id !== 'mls');
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

async function fetchWrapped(sport: string, season: number, force: boolean) {
  const { data, error } = await supabase.rpc('my_wrapped', {
    p_sport: sport,
    p_season: season,
    p_force: force,
  });
  if (error) throw error;
  return parseWrapped(data);
}

/** Stored snapshot, or a preview generated on demand. Null when there are no games that season. */
export function useWrapped(sport: string | undefined, season: number | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: wrappedKeys.payload(userId, sport ?? '', season ?? 0),
    queryFn: (): Promise<WrappedPayload | null> =>
      fetchWrapped(sport as string, season as number, false),
    enabled: !!userId && !!sport && !!season,
    staleTime: 5 * 60_000,
  });
}

/** Regenerates a preview (p_force) so it reflects games logged since the last look. */
export function useRegenerateWrapped() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { sport: string; season: number }) =>
      fetchWrapped(input.sport, input.season, true),
    onSuccess: (payload, input) => {
      queryClient.setQueryData(wrappedKeys.payload(userId, input.sport, input.season), payload);
      queryClient.invalidateQueries({ queryKey: wrappedKeys.seasons(userId) });
      queryClient.invalidateQueries({ queryKey: passportKeys.wrapped(userId) });
    },
  });
}
