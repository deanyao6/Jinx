import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { RallyCap } from './live';

/**
 * What the eggs remember on this device, so each plays once and the rally cap survives a
 * restart. Same shape as `features/teams/themeStore`: AsyncStorage, no column, no migration,
 * kept per user id where it is about a person. Game ids and team ids are not personal data.
 */
type EggMemory = {
  /** User id to the win whose broken curse was already celebrated. */
  curseCelebrated: Record<string, string>;
  /** User id to game id to the cap flipped at that game. */
  rallyCaps: Record<string, Record<string, RallyCap>>;
  /** Games that already had their confetti. Per device, not per person. */
  confettiGames: string[];
  celebrateCurse: (userId: string, gameId: string) => void;
  flipRallyCap: (userId: string, gameId: string, cap: RallyCap) => void;
  markConfetti: (gameId: string) => void;
};

export const EGG_STORAGE_KEY = 'jinx.eggs.v1';

/** Old entries fall off the end. Nobody has forty rally caps worth keeping. */
const KEEP = 40;

export const useEggStore = create<EggMemory>()(
  persist(
    (set) => ({
      curseCelebrated: {},
      rallyCaps: {},
      confettiGames: [],
      celebrateCurse: (userId, gameId) =>
        set((state) => ({ curseCelebrated: { ...state.curseCelebrated, [userId]: gameId } })),
      flipRallyCap: (userId, gameId, cap) =>
        set((state) => {
          const mine = { ...(state.rallyCaps[userId] ?? {}), [gameId]: cap };
          const kept = Object.entries(mine)
            .sort((a, b) => b[1].at - a[1].at)
            .slice(0, KEEP);
          return { rallyCaps: { ...state.rallyCaps, [userId]: Object.fromEntries(kept) } };
        }),
      markConfetti: (gameId) =>
        set((state) =>
          state.confettiGames.includes(gameId)
            ? state
            : { confettiGames: [gameId, ...state.confettiGames].slice(0, KEEP) },
        ),
    }),
    {
      name: EGG_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        curseCelebrated: state.curseCelebrated,
        rallyCaps: state.rallyCaps,
        confettiGames: state.confettiGames,
      }),
    },
  ),
);

/** Whether what was stored has been read back yet. Until then "not celebrated" is not known. */
export function useEggStoreHydrated(): boolean {
  return React.useSyncExternalStore(
    (onChange) => useEggStore.persist.onFinishHydration(onChange),
    () => useEggStore.persist.hasHydrated(),
  );
}

/**
 * The dev page's remote control (Settings, About, Easter eggs). Not persisted. The confetti
 * overlay is mounted at the root, so the page asks for a shower through here.
 */
type EggPreview = {
  confetti: { sport: string; nonce: number } | null;
  playConfetti: (sport: string) => void;
};

export const useEggPreview = create<EggPreview>()((set) => ({
  confetti: null,
  playConfetti: (sport) =>
    set((state) => ({ confetti: { sport, nonce: (state.confetti?.nonce ?? 0) + 1 } })),
}));
