import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

import { useAuthStore } from '@/features/auth/store';
import { stableJson } from '@/features/goals/builder';
import type { GhostVenue } from '@/features/passport/ui/StampsGrid';
import type { Json } from '@/lib/database.types';
import { supabase, type Rpc } from '@/lib/supabase';
import { listVenueIds, parseDefinition } from './progress';

export type BucketList = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  definition: Json;
  is_curated: boolean;
  owner_user_id: string | null;
};

export type JoinedBucketList = {
  bucket_list_id: string;
  progress: Json;
  added_at: string;
  list: BucketList;
};

export type VenueLite = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  closed_year: number | null;
  lat: number | null;
  lng: number | null;
};

const LIST_COLUMNS = 'id, slug, title, description, definition, is_curated, owner_user_id';
const VENUE_COLUMNS = 'id, name, city, state, country, closed_year, lat, lng';

export const bucketKeys = {
  all: ['bucketlists'] as const,
  visible: (userId: string | null) => ['bucketlists', 'visible', userId] as const,
  joined: (userId: string | null) => ['bucketlists', 'joined', userId] as const,
  one: (id: string) => ['bucketlists', 'one', id] as const,
  venues: (ids: string[]) => ['bucketlists', 'venues', [...ids].sort()] as const,
  searchVenues: (q: string) => ['bucketlists', 'searchVenues', q] as const,
};

/** Curated lists plus the user's own custom lists (RLS decides). */
export function useVisibleBucketLists() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: bucketKeys.visible(userId),
    queryFn: async (): Promise<BucketList[]> => {
      const { data, error } = await supabase
        .from('bucket_lists')
        .select(LIST_COLUMNS)
        .order('title');
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

export function useJoinedBucketLists() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: bucketKeys.joined(userId),
    queryFn: async (): Promise<JoinedBucketList[]> => {
      const { data, error } = await supabase
        .from('user_bucket_lists')
        .select(`bucket_list_id, progress, added_at, list:bucket_lists(${LIST_COLUMNS})`)
        .eq('user_id', userId as string)
        .order('added_at');
      if (error) throw error;
      return (
        data as unknown as (Omit<JoinedBucketList, 'list'> & { list: BucketList | null })[]
      ).filter((r): r is JoinedBucketList => r.list != null);
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useBucketList(id: string | undefined) {
  return useQuery({
    queryKey: bucketKeys.one(id ?? ''),
    queryFn: async (): Promise<BucketList> => {
      const { data, error } = await supabase
        .from('bucket_lists')
        .select(LIST_COLUMNS)
        .eq('id', id as string)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useVenuesByIds(ids: string[]) {
  return useQuery({
    queryKey: bucketKeys.venues(ids),
    queryFn: async (): Promise<VenueLite[]> => {
      const { data, error } = await supabase.from('venues').select(VENUE_COLUMNS).in('id', ids);
      if (error) throw error;
      return data.sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: ids.length > 0,
    staleTime: 24 * 60 * 60_000,
  });
}

/** Unvisited venues from every joined list, for ghost stamps and ghost map markers. */
export function useGhostVenues(visitedIds: Iterable<string>) {
  const joined = useJoinedBucketLists();
  const visitedKey = Array.from(visitedIds).sort().join(',');
  const ids = useMemo(() => {
    const visited = new Set(visitedKey ? visitedKey.split(',') : []);
    const all = new Set(
      (joined.data ?? []).flatMap((j) => listVenueIds(parseDefinition(j.list.definition))),
    );
    return Array.from(all).filter((id) => !visited.has(id));
  }, [joined.data, visitedKey]);
  const venues = useVenuesByIds(ids);
  const ghosts = useMemo<(GhostVenue & VenueLite)[]>(
    () => (venues.data ?? []).map((v) => ({ ...v, venue_id: v.id })),
    [venues.data],
  );
  return { ghosts, isPending: joined.isPending || (ids.length > 0 && venues.isPending) };
}

export type VenueHit = Rpc<'search_venues'>[number];

export function useSearchVenues(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: bucketKeys.searchVenues(trimmed.toLowerCase()),
    queryFn: async (): Promise<VenueHit[]> => {
      const { data, error } = await supabase.rpc('search_venues', {
        p_query: trimmed,
        p_limit: 12,
      });
      if (error) throw error;
      return data;
    },
    enabled: trimmed.length >= 2,
    staleTime: 60_000,
  });
}

function useInvalidateLists() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: bucketKeys.joined(userId) });
    queryClient.invalidateQueries({ queryKey: bucketKeys.visible(userId) });
  };
}

export function useJoinBucketList() {
  const userId = useAuthStore((s) => s.userId);
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: async (bucketListId: string) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('user_bucket_lists')
        .upsert(
          { user_id: userId, bucket_list_id: bucketListId },
          { onConflict: 'user_id,bucket_list_id', ignoreDuplicates: true },
        );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useLeaveBucketList() {
  const userId = useAuthStore((s) => s.userId);
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: async (bucketListId: string) => {
      const { error } = await supabase
        .from('user_bucket_lists')
        .delete()
        .eq('user_id', userId as string)
        .eq('bucket_list_id', bucketListId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export type NewCustomList = { title: string; description: string | null; venueIds: string[] };

/** Creates a custom distinct_venues list over the picked venues and joins it. */
export function useCreateBucketList() {
  const userId = useAuthStore((s) => s.userId);
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: async (input: NewCustomList): Promise<BucketList> => {
      if (!userId) throw new Error('Not signed in');
      const definition = {
        type: 'distinct_venues',
        target: input.venueIds.length,
        filter: { venue_ids: input.venueIds },
      };
      const { data, error } = await supabase
        .from('bucket_lists')
        .insert({
          owner_user_id: userId,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          is_curated: false,
          definition,
        })
        .select(LIST_COLUMNS)
        .single();
      if (error) throw error;
      const { error: joinError } = await supabase
        .from('user_bucket_lists')
        .insert({ user_id: userId, bucket_list_id: data.id });
      if (joinError) throw joinError;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteBucketList() {
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: async (bucketListId: string) => {
      const { error } = await supabase.from('bucket_lists').delete().eq('id', bucketListId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export type ListProgressSync = { bucketListId: string; stored: Json; progress: unknown | null };

/** Mirrors useSyncGoalProgress for joined lists: pushes changed progress with set_bucket_list_progress. */
export function useSyncBucketListProgress(items: ListProgressSync[]) {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const synced = useRef(new Map<string, string>());
  useEffect(() => {
    const jobs: Promise<unknown>[] = [];
    for (const item of items) {
      if (!item.progress) continue;
      const wanted = stableJson(item.progress);
      if (stableJson(item.stored) === wanted || synced.current.get(item.bucketListId) === wanted)
        continue;
      synced.current.set(item.bucketListId, wanted);
      jobs.push(
        Promise.resolve(
          supabase.rpc('set_bucket_list_progress', {
            p_bucket_list_id: item.bucketListId,
            p_progress: item.progress as Json,
          }),
        ),
      );
    }
    if (jobs.length === 0) return;
    void Promise.all(jobs).then(() => {
      queryClient.invalidateQueries({ queryKey: bucketKeys.joined(userId) });
    });
  }, [items, queryClient, userId]);
}
