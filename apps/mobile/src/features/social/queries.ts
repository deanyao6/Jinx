import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store';
import type { Json } from '@/lib/database.types';
import { supabase, type Rpc } from '@/lib/supabase';
import type { FeedEvent, ReactionEmoji } from './copy';

export const socialKeys = {
  all: ['social'] as const,
  feed: (userId: string | null) => ['social', 'feed', userId] as const,
  rivalries: (userId: string | null) => ['social', 'rivalries', userId] as const,
  overlaps: (userId: string | null) => ['social', 'overlaps', userId] as const,
  mutualsAtGame: (userId: string | null, gameId: string) =>
    ['social', 'mutualsAtGame', userId, gameId] as const,
  search: (userId: string | null, q: string) => ['social', 'search', userId, q] as const,
  profile: (userId: string | null, handle: string) =>
    ['social', 'profile', userId, handle.toLowerCase()] as const,
  requests: (userId: string | null) => ['social', 'requests', userId] as const,
  following: (userId: string | null) => ['social', 'following', userId] as const,
  blocked: (userId: string | null) => ['social', 'blocked', userId] as const,
};

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

const FEED_PAGE = 30;

function toFeedEvent(row: Rpc<'feed'>[number]): FeedEvent {
  return {
    id: row.id,
    actor_user_id: row.actor_user_id,
    actor_handle: row.actor_handle,
    actor_display_name: row.actor_display_name,
    actor_avatar_path: row.actor_avatar_path ?? null,
    type: row.type,
    game_id: row.game_id ?? null,
    payload: (row.payload as Record<string, Json | undefined> | null) ?? null,
    created_at: row.created_at,
    game: (row.game as FeedEvent['game'] | null) ?? null,
    reactions: (row.reactions as Record<string, number> | null) ?? {},
    my_reaction: row.my_reaction ?? null,
  };
}

export function useFeed() {
  const userId = useAuthStore((s) => s.userId);
  return useInfiniteQuery({
    queryKey: socialKeys.feed(userId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<FeedEvent[]> => {
      const { data, error } = await supabase.rpc('feed', {
        p_before: pageParam ?? undefined,
        p_limit: FEED_PAGE,
      });
      if (error) throw error;
      return data.map(toFeedEvent);
    },
    getNextPageParam: (last) =>
      last.length < FEED_PAGE ? undefined : (last[last.length - 1]?.created_at ?? undefined),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

type FeedData = InfiniteData<FeedEvent[], string | null>;

function patchFeedEvent(
  data: FeedData | undefined,
  eventId: string,
  patch: (e: FeedEvent) => FeedEvent,
): FeedData | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => page.map((e) => (e.id === eventId ? patch(e) : e))),
  };
}

/** Toggles my reaction on a feed event: same emoji removes it, another emoji replaces it. */
export function useReact() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (input: { event: FeedEvent; emoji: ReactionEmoji }) => {
      if (!userId) throw new Error('Not signed in');
      if (input.event.my_reaction === input.emoji) {
        const { error } = await supabase
          .from('reactions')
          .delete()
          .eq('feed_event_id', input.event.id)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('reactions')
          .upsert(
            { feed_event_id: input.event.id, user_id: userId, emoji: input.emoji },
            { onConflict: 'feed_event_id,user_id' },
          );
        if (error) throw error;
      }
    },
    onMutate: async ({ event, emoji }) => {
      const key = socialKeys.feed(userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FeedData>(key);
      queryClient.setQueryData<FeedData>(key, (data) =>
        patchFeedEvent(data, event.id, (e) => {
          const reactions = { ...e.reactions };
          if (e.my_reaction) {
            reactions[e.my_reaction] = Math.max(0, (reactions[e.my_reaction] ?? 1) - 1);
            if (reactions[e.my_reaction] === 0) delete reactions[e.my_reaction];
          }
          const removing = e.my_reaction === emoji;
          if (!removing) reactions[emoji] = (reactions[emoji] ?? 0) + 1;
          return { ...e, reactions, my_reaction: removing ? null : emoji };
        }),
      );
      return { previous };
    },
    onError: (_e, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(socialKeys.feed(userId), ctx.previous);
    },
  });
}

// ---------------------------------------------------------------------------
// Rivalries, overlap, mutuals at a game
// ---------------------------------------------------------------------------

export type Rivalry = Omit<Rpc<'rivalries'>[number], 'rival_teams'> & { rival_teams: string[] };
export type Overlap = Rpc<'overlaps'>[number];
export type MutualAtGame = Rpc<'mutuals_at_game'>[number];

export function useRivalries() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: socialKeys.rivalries(userId),
    queryFn: async (): Promise<Rivalry[]> => {
      const { data, error } = await supabase.rpc('rivalries');
      if (error) throw error;
      return data.map((r) => ({
        ...r,
        rival_teams: Array.isArray(r.rival_teams)
          ? r.rival_teams.filter((t): t is string => typeof t === 'string')
          : [],
      }));
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useOverlaps() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: socialKeys.overlaps(userId),
    queryFn: async (): Promise<Overlap[]> => {
      const { data, error } = await supabase.rpc('overlaps');
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useMutualsAtGame(gameId: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: socialKeys.mutualsAtGame(userId, gameId ?? ''),
    queryFn: async (): Promise<MutualAtGame[]> => {
      const { data, error } = await supabase.rpc('mutuals_at_game', {
        p_game_id: gameId as string,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!gameId,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Profiles: search and view
// ---------------------------------------------------------------------------

export type FollowStatus = 'active' | 'requested' | null;

export type ProfileHit = {
  id: string;
  handle: string;
  display_name: string;
  is_private: boolean;
  follow_status: FollowStatus;
  follows_me: boolean;
  avatar_path: string | null;
};

function asFollowStatus(s: string | null | undefined): FollowStatus {
  return s === 'active' || s === 'requested' ? s : null;
}

export function useSearchProfiles(query: string) {
  const userId = useAuthStore((s) => s.userId);
  const q = query.trim();
  return useQuery({
    queryKey: socialKeys.search(userId, q.toLowerCase()),
    queryFn: async (): Promise<ProfileHit[]> => {
      const { data, error } = await supabase.rpc('search_profiles', { p_query: q, p_limit: 30 });
      if (error) throw error;
      return data.map((r) => ({
        ...r,
        follow_status: asFollowStatus(r.follow_status),
        avatar_path: r.avatar_path ?? null,
      }));
    },
    enabled: !!userId && q.length >= 2,
    staleTime: 15_000,
  });
}

export type ProfileTeam = { team_id: string; name: string; sport_id: string };

export type ProfileView = {
  id: string;
  handle: string;
  /** True (with only id and handle populated) when I blocked this user. */
  blocked_by_me?: boolean;
  display_name: string;
  avatar_path: string | null;
  home_city: string | null;
  is_private: boolean;
  is_me: boolean;
  can_view: boolean;
  follow_status: FollowStatus;
  follows_me: boolean;
  is_mutual: boolean;
  teams: ProfileTeam[];
  followers: number;
  following: number;
  /** user_stats_cache payload; parse with features/passport/format parseStats. */
  stats: unknown;
};

export function useProfileView(handle: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: socialKeys.profile(userId, handle ?? ''),
    queryFn: async (): Promise<ProfileView | null> => {
      const { data, error } = await supabase.rpc('profile_view', { p_handle: handle as string });
      if (error) throw error;
      if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
      const raw = data as Record<string, Json | undefined>;
      if (raw['blocked_by_me'] === true) {
        return {
          id: String(raw['id']),
          handle: String(raw['handle']),
          blocked_by_me: true,
          display_name: '',
          avatar_path: null,
          home_city: null,
          is_private: false,
          is_me: false,
          can_view: false,
          follow_status: null,
          follows_me: false,
          is_mutual: false,
          teams: [],
          followers: 0,
          following: 0,
          stats: null,
        };
      }
      return {
        ...(raw as unknown as ProfileView),
        follow_status: asFollowStatus(raw['follow_status'] as string | null),
        teams: Array.isArray(raw['teams']) ? (raw['teams'] as unknown as ProfileTeam[]) : [],
        stats: raw['stats'] ?? null,
      };
    },
    enabled: !!userId && !!handle,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Follows
// ---------------------------------------------------------------------------

function useInvalidateSocial() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: socialKeys.all });
}

/** Inserts a follow row; the server marks it 'requested' for private accounts. */
export function useFollow() {
  const userId = useAuthStore((s) => s.userId);
  const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: async (input: { userId: string }) => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('follows')
        .insert({ follower_id: userId, followee_id: input.userId })
        .select('status')
        .single();
      if (error) throw error;
      return asFollowStatus(data.status);
    },
    onSettled: invalidate,
  });
}

/** Deletes my follow row: unfollow or cancel a pending request. */
export function useUnfollow() {
  const userId = useAuthStore((s) => s.userId);
  const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: async (input: { userId: string }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', userId)
        .eq('followee_id', input.userId);
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export type FollowRequest = {
  follower_id: string;
  created_at: string;
  profile: { id: string; handle: string; display_name: string; avatar_path: string | null } | null;
};

export function useFollowRequests() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: socialKeys.requests(userId),
    queryFn: async (): Promise<FollowRequest[]> => {
      const { data, error } = await supabase
        .from('follows')
        .select(
          'follower_id, created_at, profile:profiles!follows_follower_id_fkey(id, handle, display_name, avatar_path)',
        )
        .eq('followee_id', userId as string)
        .eq('status', 'requested')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as FollowRequest[];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useAcceptRequest() {
  const userId = useAuthStore((s) => s.userId);
  const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: async (input: { followerId: string }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('follows')
        .update({ status: 'active' })
        .eq('follower_id', input.followerId)
        .eq('followee_id', userId);
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export function useDeclineRequest() {
  const userId = useAuthStore((s) => s.userId);
  const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: async (input: { followerId: string }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', input.followerId)
        .eq('followee_id', userId);
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export type FollowedUser = {
  id: string;
  handle: string;
  display_name: string;
  avatar_path: string | null;
};

/** People I actively follow, for tagging companions. */
export function useFollowing() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: socialKeys.following(userId),
    queryFn: async (): Promise<FollowedUser[]> => {
      const { data, error } = await supabase
        .from('follows')
        .select(
          'followee_id, profile:profiles!follows_followee_id_fkey(id, handle, display_name, avatar_path)',
        )
        .eq('follower_id', userId as string)
        .eq('status', 'active');
      if (error) throw error;
      return (data as unknown as { profile: FollowedUser | null }[])
        .map((r) => r.profile)
        .filter((p): p is FollowedUser => p != null)
        .sort((a, b) => (a.display_name || a.handle).localeCompare(b.display_name || b.handle));
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Blocks and reports
// ---------------------------------------------------------------------------

export type BlockedUser = Rpc<'blocked_users'>[number];

/** People I blocked, with names (the blocked_users RPC bypasses the two-way profile RLS). */
export function useBlockedUsers() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: socialKeys.blocked(userId),
    queryFn: async (): Promise<BlockedUser[]> => {
      const { data, error } = await supabase.rpc('blocked_users');
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useBlock() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (input: { userId: string }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('blocks')
        .insert({ blocker_id: userId, blocked_id: input.userId });
      if (error) throw error;
    },
    onSettled: () => {
      // Blocking removes follows both ways and hides the user everywhere.
      queryClient.invalidateQueries({ queryKey: socialKeys.all });
      queryClient.invalidateQueries({ queryKey: ['people'] });
    },
  });
}

export function useUnblock() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (input: { userId: string }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', userId)
        .eq('blocked_id', input.userId);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: socialKeys.all }),
  });
}

export type ReportTarget = 'user' | 'attendance' | 'feed_event' | 'person' | 'attendance_photo';

export const REPORT_REASONS = [
  'Impersonation',
  'Harassment or bullying',
  'Spam or scam',
  'Inappropriate name or content',
  'Something else',
] as const;

export function useReport() {
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (input: { targetType: ReportTarget; targetId: string; reason: string }) => {
      if (!userId) throw new Error('Not signed in');
      const reason = input.reason.trim().slice(0, 500);
      if (!reason) throw new Error('Pick a reason');
      const { error } = await supabase.from('reports').insert({
        reporter_id: userId,
        target_type: input.targetType,
        target_id: input.targetId,
        reason,
      });
      if (error) throw error;
    },
  });
}
