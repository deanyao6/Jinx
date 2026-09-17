import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useAuthStore } from '@/features/auth/store';

/**
 * Which favourite team the app wears (Dean, 2026-09-17: "a theme picker in settings between
 * favorite teams").
 *
 * It is an appearance setting on this device, so it lives in AsyncStorage and not in the
 * database: no column, no migration, and a second phone can wear a different team. It is kept
 * per user id, so two accounts on one phone do not share a choice and signing out has nothing to
 * clear. A team id is not personal data, and an id left behind by a deleted account matches
 * nobody.
 */
type ThemeTeamState = {
  /** User id to the team id that person picked. No entry means "my first favourite". */
  byUser: Record<string, string>;
  setThemeTeam: (userId: string, teamId: string | null) => void;
};

export const THEME_TEAM_STORAGE_KEY = 'jinx.theme-team.v1';

export const useThemeTeamStore = create<ThemeTeamState>()(
  persist(
    (set) => ({
      byUser: {},
      setThemeTeam: (userId, teamId) =>
        set((state) => {
          const next = { ...state.byUser };
          if (teamId) next[userId] = teamId;
          else delete next[userId];
          return { byUser: next };
        }),
    }),
    {
      name: THEME_TEAM_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ byUser: state.byUser }),
    },
  ),
);

/**
 * The team whose colours the app wears: the stored one if it is still a favourite, else the first
 * favourite, else none, which is the neutral theme.
 *
 * A stored team that has since been removed is ignored rather than erased. Nothing is written
 * while rendering, and adding the team back brings the choice back with it.
 */
export function resolveThemeTeamId(
  storedTeamId: string | null | undefined,
  favorites: readonly { id: string }[] | null | undefined,
): string | undefined {
  if (!favorites || favorites.length === 0) return undefined;
  if (storedTeamId && favorites.some((t) => t.id === storedTeamId)) return storedTeamId;
  return favorites[0]?.id;
}

/** The signed-in person's stored pick on this device, or null. Not checked against favourites. */
export function useStoredThemeTeamId(): string | null {
  const userId = useAuthStore((s) => s.userId);
  return useThemeTeamStore((s) => (userId ? (s.byUser[userId] ?? null) : null));
}

/** Sets the signed-in person's pick. Does nothing signed out. */
export function useSetThemeTeam(): (teamId: string | null) => void {
  const userId = useAuthStore((s) => s.userId);
  const setThemeTeam = useThemeTeamStore((s) => s.setThemeTeam);
  return (teamId) => {
    if (userId) setThemeTeam(userId, teamId);
  };
}
