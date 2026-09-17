import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store';
import { supabase } from '@/lib/supabase';

import {
  handshakePollInterval,
  parseOfferResult,
  type HandshakeRow,
  type OfferResult,
} from './handshake';

/**
 * The three questions the secret handshake asks the server. Every one of them is disabled unless
 * the caller passes `enabled`, which is where the egg's switch and demo mode are decided, so a
 * screen with the egg off makes no request at all.
 *
 * Polling, not realtime: the app has no realtime subscriptions and this does not start one.
 */

export type HandshakeCandidate = { user_id: string; avatar_path: string | null };

export const handshakeKeys = {
  all: ['handshakes'] as const,
  candidates: (userId: string | null, gameId: string) =>
    ['handshakes', 'candidates', userId, gameId] as const,
  mine: (userId: string | null, gameId: string) => ['handshakes', 'mine', userId, gameId] as const,
};

/** Mutual follows checked in to this game. Empty unless the caller is checked in too. */
export function useHandshakeCandidates(gameId: string | undefined, enabled: boolean) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: handshakeKeys.candidates(userId, gameId ?? ''),
    queryFn: async (): Promise<HandshakeCandidate[]> => {
      const { data, error } = await supabase.rpc('handshake_candidates', {
        p_game_id: gameId as string,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: enabled && !!userId && !!gameId,
    staleTime: 30_000,
  });
}

/**
 * Who the caller has offered to at this game, waiting or complete. Asks again every 15 seconds
 * while the screen is focused, the window is open and an offer is still waiting.
 */
export function useMyHandshakes(
  gameId: string | undefined,
  options: { enabled: boolean; focused: boolean; windowOpen: boolean },
) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: handshakeKeys.mine(userId, gameId ?? ''),
    queryFn: async (): Promise<HandshakeRow[]> => {
      const { data, error } = await supabase.rpc('my_handshakes', { p_game_id: gameId as string });
      if (error) throw error;
      return data ?? [];
    },
    enabled: options.enabled && !!userId && !!gameId,
    staleTime: 10_000,
    refetchInterval: (query) =>
      handshakePollInterval({
        focused: options.focused,
        windowOpen: options.windowOpen,
        rows: query.state.data,
      }),
  });
}

export function useOfferHandshake(gameId: string | undefined) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    // Nothing reads a finished offer back out of the mutation cache: the answer is acted on in
    // `onSuccess` and the state lives in `my_handshakes`. So it need not linger for five minutes.
    gcTime: 0,
    mutationFn: async (input: { toUserId: string }): Promise<OfferResult> => {
      if (!userId || !gameId) throw new Error('Not signed in');
      const { data, error } = await supabase.rpc('offer_handshake', {
        p_game_id: gameId,
        p_to_user: input.toUserId,
      });
      if (error) throw error;
      return parseOfferResult(data);
    },
    onSettled: () => {
      if (gameId) {
        void queryClient.invalidateQueries({ queryKey: handshakeKeys.mine(userId, gameId) });
      }
    },
  });
}
