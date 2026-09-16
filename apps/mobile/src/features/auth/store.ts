import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { setSentryUser } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthState = {
  status: AuthStatus;
  session: Session | null;
  userId: string | null;
  setSession: (session: Session | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  session: null,
  userId: null,
  setSession: (session) => {
    setSentryUser(session?.user.id ?? null);
    set({
      session,
      userId: session?.user.id ?? null,
      status: session ? 'signedIn' : 'signedOut',
    });
  },
}));

/**
 * Loads the persisted session and keeps the store in sync with supabase-js.
 * Returns an unsubscribe function for the root layout effect.
 */
export function startAuthListener(): () => void {
  const setSession = useAuthStore.getState().setSession;
  supabase.auth
    .getSession()
    .then(({ data }) => setSession(data.session))
    .catch(() => setSession(null));
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
  });
  return () => data.subscription.unsubscribe();
}
