import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store';
import { supabase } from '@/lib/supabase';

import type { FavoritePlayerSeenRow } from './passport';

/**
 * Favourite players, and the rosters the picker drills into (SPEC.md 5.1, 6.9).
 *
 * Teams have been favouritable since M1 through `user_teams`; this is the player half, and
 * it mirrors that one deliberately, including the "replace the whole list" mutation shape.
 */

export type Player = { id: string; full_name: string };

/** One row of a team's roster. */
export type RosterPlayer = Player & {
  /** Games this player appeared in for this team, across everything ingested. */
  appearances: number;
  /** Of those, how many the signed-in user was at. The reason to follow someone. */
  seen_by_you: number;
};

export const playerKeys = {
  favorites: (userId: string | null) => ['players', 'favorites', userId] as const,
  seen: (userId: string | null) => ['players', 'favorites-seen', userId] as const,
  roster: (teamId: string | undefined, query: string) =>
    ['players', 'roster', teamId, query] as const,
};

export function useFavoritePlayers() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: playerKeys.favorites(userId),
    queryFn: async (): Promise<Player[]> => {
      const { data, error } = await supabase
        .from('user_players')
        .select('player_id, player:players(id, full_name)')
        .eq('user_id', userId as string);
      if (error) throw error;
      return (data as unknown as { player: Player | null }[])
        .map((row) => row.player)
        .filter((p): p is Player => p != null)
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

/**
 * Your favourite players with how often you have seen each, per team, for the Passport.
 * See `passport.ts` for how the rows become list items.
 */
export function useFavoritePlayersSeen() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: playerKeys.seen(userId),
    queryFn: async (): Promise<FavoritePlayerSeenRow[]> => {
      const { data, error } = await supabase.rpc('favorite_players_seen');
      if (error) throw error;
      return (data ?? []) as FavoritePlayerSeenRow[];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/**
 * Adds or removes one player, and updates the cache before the round trip.
 *
 * A toggle rather than `useSetFavoriteTeams`'s replace-the-whole-list, because the player
 * picker is a drill-down: you are three screens deep on one team's roster and tapping one
 * name. Sending the entire favourite list from there would make an unrelated player added
 * on another device disappear.
 */
export function useToggleFavoritePlayer() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  const key = playerKeys.favorites(userId);
  return useMutation({
    mutationFn: async ({ player, on }: { player: Player; on: boolean }) => {
      if (!userId) throw new Error('Not signed in');
      if (on) {
        const { error } = await supabase
          .from('user_players')
          .upsert({ user_id: userId, player_id: player.id }, { onConflict: 'user_id,player_id' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_players')
          .delete()
          .eq('user_id', userId)
          .eq('player_id', player.id);
        if (error) throw error;
      }
      return player;
    },
    onMutate: async ({ player, on }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Player[]>(key) ?? [];
      const next = on
        ? [...previous.filter((p) => p.id !== player.id), player].sort((a, b) =>
            a.full_name.localeCompare(b.full_name),
          )
        : previous.filter((p) => p.id !== player.id);
      queryClient.setQueryData(key, next);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: playerKeys.seen(userId) });
    },
  });
}

/**
 * Everyone who has ever appeared for a team, most appearances first.
 *
 * `players` carries no team, because a player moves and the truth is per game. The
 * `team_roster` RPC derives it from `game_appearances`; see the migration for why "ever
 * appeared" is the right set rather than a current roster.
 */
export function useTeamRoster(teamId: string | undefined, query: string) {
  return useQuery({
    queryKey: playerKeys.roster(teamId, query.trim()),
    queryFn: async (): Promise<RosterPlayer[]> => {
      const { data, error } = await supabase.rpc('team_roster', {
        p_team_id: teamId as string,
        p_query: query.trim() || undefined,
        p_limit: 200,
      });
      if (error) throw error;
      return (data ?? []) as RosterPlayer[];
    },
    enabled: !!teamId,
    staleTime: 10 * 60_000,
  });
}
