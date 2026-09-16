import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { startAuthListener, useAuthStore } from './store';

export function useAuth() {
  return useAuthStore();
}

/** Returns the signed-in user id, throwing if called from a screen that requires a session. */
export function useUserId(): string {
  const userId = useAuthStore((s) => s.userId);
  if (!userId) throw new Error('useUserId called without a session');
  return userId;
}

export function useAuthListener(): void {
  useEffect(() => startAuthListener(), []);
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  }, [queryClient]);
}
