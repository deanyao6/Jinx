import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store';
import { teamKeys, type Team, TEAM_COLUMNS } from '@/features/teams/queries';
import { normalizeHandle } from '@/lib/handle';
import { supabase, type Tables } from '@/lib/supabase';

export type Profile = Tables<'profiles'>;

export const profileKeys = {
  all: ['profile'] as const,
  me: (userId: string | null) => ['profile', 'me', userId] as const,
  favorites: (userId: string | null) => ['profile', 'favorites', userId] as const,
  inbound: (userId: string | null) => ['profile', 'inbound', userId] as const,
  handle: (handle: string) => ['profile', 'handle', handle] as const,
};

async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export function useProfile() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: profileKeys.me(userId),
    queryFn: () => fetchProfile(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

export type ProfilePatch = Partial<
  Pick<
    Profile,
    | 'handle'
    | 'display_name'
    | 'home_city'
    | 'home_lat'
    | 'home_lng'
    | 'birth_date'
    | 'onboarded_at'
    | 'is_private'
    | 'share_seats'
    | 'show_on_overlap'
  >
>;

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', userId)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKeys.me(userId), profile);
    },
  });
}

/** True when no other visible profile owns the handle. The unique index is the final word. */
export function useHandleAvailable(rawHandle: string, enabled: boolean) {
  const userId = useAuthStore((s) => s.userId);
  const handle = normalizeHandle(rawHandle);
  return useQuery({
    queryKey: profileKeys.handle(handle),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('handle', handle)
        .neq('id', userId as string)
        .maybeSingle();
      if (error) throw error;
      return data == null;
    },
    enabled: enabled && !!userId && handle.length >= 3,
    staleTime: 10_000,
  });
}

export function useFavoriteTeams() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: profileKeys.favorites(userId),
    queryFn: async (): Promise<Team[]> => {
      const { data, error } = await supabase
        .from('user_teams')
        .select(`team_id, team:teams(${TEAM_COLUMNS})`)
        .eq('user_id', userId as string);
      if (error) throw error;
      return data
        .map((row) => row.team)
        .filter((t): t is Team => t != null)
        .sort((a, b) => a.sport_id.localeCompare(b.sport_id) || a.name.localeCompare(b.name));
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

/** Replaces the favorite list. Optimistically updates the cache with the picked teams. */
export function useSetFavoriteTeams() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (teams: Team[]) => {
      if (!userId) throw new Error('Not signed in');
      const ids = teams.map((t) => t.id);
      const del = supabase.from('user_teams').delete().eq('user_id', userId);
      const { error: delError } = ids.length
        ? await del.not('team_id', 'in', `(${ids.join(',')})`)
        : await del;
      if (delError) throw delError;
      if (ids.length) {
        const { error } = await supabase.from('user_teams').upsert(
          ids.map((team_id) => ({ user_id: userId, team_id })),
          { onConflict: 'user_id,team_id', ignoreDuplicates: true },
        );
        if (error) throw error;
      }
      return teams;
    },
    onMutate: async (teams) => {
      await queryClient.cancelQueries({ queryKey: profileKeys.favorites(userId) });
      const previous = queryClient.getQueryData<Team[]>(profileKeys.favorites(userId));
      queryClient.setQueryData(profileKeys.favorites(userId), teams);
      return { previous };
    },
    onError: (_err, _teams, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(profileKeys.favorites(userId), ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.favorites(userId) });
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
    },
  });
}

export function useInboundAddress() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: profileKeys.inbound(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inbound_addresses')
        .select('token')
        .eq('user_id', userId as string)
        .maybeSingle();
      if (error) throw error;
      return data?.token ?? null;
    },
    enabled: !!userId,
    staleTime: Infinity,
  });
}
