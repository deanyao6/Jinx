import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { attendanceKeys } from '@/features/attendances/queries';
import { useAuthStore } from '@/features/auth/store';
import { GAME_DETAIL_SELECT, type GameDetail } from '@/features/games/queries';
import { supabase, type Tables } from '@/lib/supabase';

export type TicketImport = Tables<'ticket_imports'>;

export const importKeys = {
  all: ['imports'] as const,
  list: (userId: string | null) => ['imports', 'list', userId] as const,
  games: (ids: string[]) => ['imports', 'games', [...ids].sort()] as const,
  thumb: (path: string) => ['imports', 'thumb', path] as const,
};

/** All of the user's ticket imports except discarded ones, newest first. */
export function useTicketImports() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: importKeys.list(userId),
    queryFn: async (): Promise<TicketImport[]> => {
      const { data, error } = await supabase
        .from('ticket_imports')
        .select('*')
        .eq('user_id', userId as string)
        .neq('status', 'discarded')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/** Candidate and makeup games referenced by the inbox, fetched in one batch. */
export function useImportGames(ids: string[]) {
  return useQuery({
    queryKey: importKeys.games(ids),
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

/** Short-lived signed URL so the owner (and only the owner) can see a thumbnail of their upload. */
export function useImportThumbnail(storagePath: string | null) {
  return useQuery({
    queryKey: importKeys.thumb(storagePath ?? ''),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.storage
        .from('ticket-imports')
        .createSignedUrl(storagePath as string, 300);
      if (error) return null;
      return data.signedUrl;
    },
    enabled: !!storagePath && !storagePath.toLowerCase().endsWith('.pdf'),
    staleTime: 240_000,
  });
}

export function useInvalidateImports() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return () => {
    queryClient.invalidateQueries({ queryKey: importKeys.list(userId) });
    queryClient.invalidateQueries({ queryKey: attendanceKeys.list(userId) });
  };
}

export function useConfirmImport() {
  const invalidate = useInvalidateImports();
  return useMutation({
    mutationFn: async (input: { importId: string; gameId: string }) => {
      const { data, error } = await supabase.rpc('confirm_ticket_import', {
        p_import_id: input.importId,
        p_game_id: input.gameId,
      });
      if (error) throw error;
      return data as unknown as { attendance_id: string; status: 'going' | 'attended' };
    },
    onSuccess: () => invalidate(),
  });
}

export function useDiscardImport() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (importId: string) => {
      const { error } = await supabase.rpc('discard_ticket_import', { p_import_id: importId });
      if (error) throw error;
    },
    onMutate: async (importId) => {
      await queryClient.cancelQueries({ queryKey: importKeys.list(userId) });
      const previous = queryClient.getQueryData<TicketImport[]>(importKeys.list(userId));
      queryClient.setQueryData<TicketImport[]>(importKeys.list(userId), (prev) =>
        (prev ?? []).filter((i) => i.id !== importId),
      );
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(importKeys.list(userId), ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: importKeys.list(userId) }),
  });
}
