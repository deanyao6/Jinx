import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store';
import { GAME_DETAIL_SELECT, type GameDetail } from '@/features/games/queries';
import { supabase, type Rpc } from '@/lib/supabase';
import { parseStats } from './format';
import type { StatsPayload } from './types';

export const passportKeys = {
  all: ['passport'] as const,
  stats: (userId: string | null) => ['passport', 'stats', userId] as const,
  wrapped: (userId: string | null) => ['passport', 'wrapped', userId] as const,
  venueGames: (userId: string | null, venueId: string) =>
    ['passport', 'venueGames', userId, venueId] as const,
  momentGames: (userId: string | null, type: string) =>
    ['passport', 'momentGames', userId, type] as const,
  players: (userId: string | null, query: string) =>
    ['passport', 'players', userId, query] as const,
  gamesByIds: (ids: string[]) => ['passport', 'gamesByIds', [...ids].sort()] as const,
};

async function refreshStats(): Promise<StatsPayload> {
  const { data, error } = await supabase.rpc('refresh_my_stats');
  if (error) throw error;
  return parseStats(data);
}

/** Own cached stats; computes them on first read when the cache row does not exist yet. */
export function useMyStats() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: passportKeys.stats(userId),
    queryFn: async (): Promise<StatsPayload> => {
      const { data, error } = await supabase
        .from('user_stats_cache')
        .select('payload')
        .eq('user_id', userId as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) return refreshStats();
      return parseStats(data.payload);
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/** Recomputes the stats server-side (pull to refresh). */
export function useRefreshStats() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: refreshStats,
    onSuccess: (payload) => {
      queryClient.setQueryData(passportKeys.stats(userId), payload);
    },
  });
}

export type WrappedRef = { sport_id: string; season: number; generated_at: string };

/** Newest Wrapped snapshot for the banner, if any. */
export function useLatestWrapped() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: passportKeys.wrapped(userId),
    queryFn: async (): Promise<WrappedRef | null> => {
      const { data, error } = await supabase
        .from('wrapped_snapshots')
        .select('sport_id, season, generated_at')
        .eq('user_id', userId as string)
        .order('season', { ascending: false })
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

export type VenueGame = { attendance_id: string; game: GameDetail };

const VENUE_GAME_SELECT = `id, game:games!inner(${GAME_DETAIL_SELECT})`;

/** Your attended games at one venue, newest first. */
export function useVenueGames(venueId: string | null) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: passportKeys.venueGames(userId, venueId ?? ''),
    queryFn: async (): Promise<VenueGame[]> => {
      const { data, error } = await supabase
        .from('attendances')
        .select(VENUE_GAME_SELECT)
        .eq('user_id', userId as string)
        .eq('status', 'attended')
        .eq('game.venue_id', venueId as string);
      if (error) throw error;
      const rows = data as unknown as { id: string; game: GameDetail }[];
      return rows
        .map((r) => ({ attendance_id: r.id, game: r.game }))
        .sort((a, b) => b.game.scheduled_start.localeCompare(a.game.scheduled_start));
    },
    enabled: !!userId && !!venueId,
    staleTime: 60_000,
  });
}

export type MomentGame = {
  attendance_id: string;
  game: GameDetail & {
    events: {
      type: string;
      detail: Record<string, unknown>;
      player: { full_name: string } | null;
    }[];
  };
};

/** Your attended games where a given moment type happened (game_events join). */
export function useMomentGames(type: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: passportKeys.momentGames(userId, type ?? ''),
    queryFn: async (): Promise<MomentGame[]> => {
      const { data, error } = await supabase
        .from('attendances')
        .select(
          `id, game:games!inner(${GAME_DETAIL_SELECT},
            events:game_events!inner(type, detail, player:players(full_name)))`,
        )
        .eq('user_id', userId as string)
        .eq('status', 'attended')
        .eq('game.events.type', type as string);
      if (error) throw error;
      const rows = data as unknown as { id: string; game: MomentGame['game'] }[];
      return rows
        .map((r) => ({ attendance_id: r.id, game: r.game }))
        .sort((a, b) => b.game.scheduled_start.localeCompare(a.game.scheduled_start));
    },
    enabled: !!userId && !!type,
    staleTime: 60_000,
  });
}

export type PlayerSeen = Rpc<'players_seen'>[number];

const PLAYERS_PAGE = 50;

/** Players seen sorted by count, searchable, paginated through the players_seen RPC. */
export function usePlayersSeen(query: string) {
  const userId = useAuthStore((s) => s.userId);
  const trimmed = query.trim();
  return useInfiniteQuery({
    queryKey: passportKeys.players(userId, trimmed.toLowerCase()),
    queryFn: async ({ pageParam }): Promise<PlayerSeen[]> => {
      const { data, error } = await supabase.rpc('players_seen', {
        p_user: userId as string,
        p_query: trimmed || undefined,
        p_limit: PLAYERS_PAGE,
        p_offset: pageParam,
      });
      if (error) throw error;
      return data;
    },
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length < PLAYERS_PAGE ? undefined : pages.length * PLAYERS_PAGE,
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/** Games by id, for superlative rows that point at a game. */
export function useGamesByIds(ids: string[]) {
  return useQuery({
    queryKey: passportKeys.gamesByIds(ids),
    queryFn: async (): Promise<Map<string, GameDetail>> => {
      const { data, error } = await supabase.from('games').select(GAME_DETAIL_SELECT).in('id', ids);
      if (error) throw error;
      const map = new Map<string, GameDetail>();
      for (const g of data as unknown as GameDetail[]) map.set(g.id, g);
      return map;
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
  });
}
