import { create } from 'zustand';

/**
 * Cross-screen navigation intents. Onboarding sets a route to open once the signed-in guard
 * flips (the target routes do not exist in the navigator until then).
 */
type NavState = {
  pendingRoute: string | null;
  setPendingRoute: (route: string | null) => void;
};

export const useNavStore = create<NavState>((set) => ({
  pendingRoute: null,
  setPendingRoute: (pendingRoute) => set({ pendingRoute }),
}));
