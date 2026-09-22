import {
  parseSearch,
  resolveSearch,
  type SearchCandidate,
  type SearchFilters,
  type SearchPlan,
} from '@jinx/core';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/hooks';
import type { Json } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import type { GameSearchHit } from '../queries';

export type SearchScope = 'mine' | 'all';
export type SearchSort = 'best' | 'newest' | 'oldest';
export type SearchRow = Omit<
  GameSearchHit,
  'home_score' | 'away_score' | 'venue_id' | 'venue_name' | 'venue_city' | 'doubleheader_number'
> & {
  home_score: number | null;
  away_score: number | null;
  venue_id: string | null;
  venue_name: string | null;
  venue_city: string | null;
  doubleheader_number: number | null;
  logged: boolean;
  local_date: string;
  decision_method: string | null;
  home_shootout_score: number | null;
  away_shootout_score: number | null;
};
type Page = { rows: SearchRow[]; nextCursor: Json | null };

export function useSearchInterpretation(query: string, filters: SearchFilters) {
  const { userId } = useAuth();
  const parsed = parseSearch(query, filters);
  const result = useQuery({
    queryKey: ['search-v2', 'entities', userId, parsed.phrases, parsed.filters.sport],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc('search_entities_v2', {
          p_phrases: parsed.phrases,
          p_sport: parsed.filters.sport,
        })
        .abortSignal(signal);
      if (error) throw error;
      return data as unknown as SearchCandidate[];
    },
    enabled: !!userId && !parsed.error && parsed.phrases.length > 0,
    staleTime: 60_000,
  });
  const candidates = result.data ?? [];
  const plans = resolveSearch(parsed, candidates);
  return {
    ...result,
    parsed,
    candidates,
    plans,
    resolving: parsed.phrases.length > 0 && result.isPending && !parsed.error,
  };
}

export function useRankedGames(input: {
  query: string;
  filters: SearchFilters;
  plan?: SearchPlan;
  scope: SearchScope;
  sort: SearchSort;
  personalText: boolean;
  enabled: boolean;
}) {
  const { userId } = useAuth();
  const selection = input.plan
    ? {
        teamIds: input.plan.teamIds,
        ...(input.plan.venueId ? { venueId: input.plan.venueId } : {}),
        ...(input.plan.homeId ? { homeId: input.plan.homeId, awayId: input.plan.awayId } : {}),
      }
    : {};
  return useInfiniteQuery({
    queryKey: [
      'search-v2',
      'games',
      userId,
      input.query,
      input.filters,
      selection,
      input.scope,
      input.sort,
      input.personalText,
    ],
    initialPageParam: null as Json | null,
    queryFn: async ({ pageParam, signal }): Promise<Page> => {
      const { data, error } = await supabase
        .rpc('search_games_v2', {
          p_filters: input.filters as Json,
          p_selection: selection as Json,
          p_query: input.query,
          p_scope: input.scope,
          p_sort: input.sort,
          p_cursor: pageParam ?? undefined,
          p_limit: 25,
          p_personal_text: input.personalText,
        })
        .abortSignal(signal);
      if (error) throw error;
      return data as unknown as Page;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!userId && input.enabled,
    staleTime: 60_000,
  });
}
