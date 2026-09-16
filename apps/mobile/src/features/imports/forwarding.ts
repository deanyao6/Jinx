import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store';
import { profileKeys } from '@/features/profile/queries';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export function forwardingAddress(token: string | null | undefined): string | null {
  return token ? `u-${token}@${env.inboundEmailDomain}` : null;
}

export const forwardingKeys = {
  emails: (userId: string | null) => ['forwarding', 'emails', userId] as const,
};

export function useRotateInboundToken() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc('rotate_inbound_token');
      if (error) throw error;
      return data;
    },
    onSuccess: (token) => {
      queryClient.setQueryData(profileKeys.inbound(userId), token);
    },
  });
}

export type UserEmail = { email: string; verified: boolean; created_at: string };

export function useUserEmails() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: forwardingKeys.emails(userId),
    queryFn: async (): Promise<UserEmail[]> => {
      const { data, error } = await supabase
        .from('user_emails')
        .select('email, verified, created_at')
        .eq('user_id', userId as string)
        .order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function isPlausibleEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/** Adds an unverified sender address. It becomes verified when mail from it arrives (docs/progress.md). */
export function useAddUserEmail() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (email: string) => {
      if (!userId) throw new Error('Not signed in');
      const normalized = email.trim().toLowerCase();
      if (!isPlausibleEmail(normalized)) throw new Error('Enter a full email address.');
      const { error } = await supabase
        .from('user_emails')
        .upsert({ user_id: userId, email: normalized }, { onConflict: 'user_id,email' });
      if (error) throw error;
      return normalized;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: forwardingKeys.emails(userId) }),
  });
}

export function useRemoveUserEmail() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase
        .from('user_emails')
        .delete()
        .eq('user_id', userId as string)
        .eq('email', email);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: forwardingKeys.emails(userId) }),
  });
}
