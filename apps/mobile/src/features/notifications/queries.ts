import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store';
import { supabase, type Tables } from '@/lib/supabase';
import { readPrefs, type NotificationKind, type Prefs } from './kinds';

export type Notification = Tables<'notifications'>;

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (userId: string | null) => ['notifications', 'list', userId] as const,
  prefs: (userId: string | null) => ['notifications', 'prefs', userId] as const,
};

export function useNotifications() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: notificationKeys.list(userId),
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId as string)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useUnreadCount(): number {
  const list = useNotifications();
  return (list.data ?? []).filter((n) => !n.read_at).length;
}

/** Marks the given ids read, or everything when called with no ids. */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (ids?: string[]) => {
      const { error } = await supabase.rpc(
        'mark_notifications_read',
        ids && ids.length ? { p_ids: ids } : {},
      );
      if (error) throw error;
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.list(userId) });
      const now = new Date().toISOString();
      queryClient.setQueryData<Notification[]>(notificationKeys.list(userId), (prev) =>
        (prev ?? []).map((n) =>
          n.read_at || (ids && !ids.includes(n.id)) ? n : { ...n, read_at: now },
        ),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) }),
  });
}

export function useNotificationPrefs() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: notificationKeys.prefs(userId),
    queryFn: async (): Promise<Prefs> => {
      const { data, error } = await supabase
        .from('notification_prefs')
        .select('prefs')
        .eq('user_id', userId as string)
        .maybeSingle();
      if (error) throw error;
      return readPrefs(data?.prefs);
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

export function useSetNotificationPref() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (input: { kind: NotificationKind; enabled: boolean }) => {
      if (!userId) throw new Error('Not signed in');
      const current = queryClient.getQueryData<Prefs>(notificationKeys.prefs(userId)) ?? {};
      const prefs: Prefs = { ...current, [input.kind]: input.enabled };
      const { error } = await supabase
        .from('notification_prefs')
        .upsert({ user_id: userId, prefs, updated_at: new Date().toISOString() });
      if (error) throw error;
      return prefs;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.prefs(userId) });
      const previous = queryClient.getQueryData<Prefs>(notificationKeys.prefs(userId));
      queryClient.setQueryData<Prefs>(notificationKeys.prefs(userId), (prev) => ({
        ...(prev ?? {}),
        [input.kind]: input.enabled,
      }));
      return { previous };
    },
    onError: (_e, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(notificationKeys.prefs(userId), ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.prefs(userId) }),
  });
}

/** Where a notification tap should go. Returns null when there is nowhere to go. */
export function notificationRoute(n: { kind: string; data: unknown }): string | null {
  const data = (n.data && typeof n.data === 'object' ? n.data : {}) as Record<string, unknown>;
  const gameId = typeof data.game_id === 'string' ? data.game_id : null;
  switch (n.kind) {
    case 'game_day':
      return gameId ? `/games/checkin/${gameId}` : '/games?segment=upcoming';
    case 'pledge_result':
    case 'pledge_void':
    case 'tagged':
      return gameId ? `/games/${gameId}` : null;
    case 'import_review':
      return '/games/imports';
    case 'email_verified':
    case 'inbound_rejected':
      return '/you/forwarding';
    case 'follow_request':
      return '/friends/requests';
    case 'new_follower':
      return '/profile';
    case 'wrapped_ready': {
      const sport = typeof data.sport_id === 'string' ? data.sport_id : null;
      const season = typeof data.season === 'number' ? data.season : null;
      return sport && season ? `/wrapped/${sport}/${season}` : '/';
    }
    case 'goal_completed':
    case 'new_stamp':
    case 'milestone':
      return '/';
    default:
      return gameId ? `/games/${gameId}` : null;
  }
}
