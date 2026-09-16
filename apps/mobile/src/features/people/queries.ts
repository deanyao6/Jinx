import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store';
import { supabase, type Rpc } from '@/lib/supabase';

export type Person = { id: string; display_name: string; linked_user_id: string | null };

export const peopleKeys = {
  all: ['people'] as const,
  list: (userId: string | null) => ['people', 'list', userId] as const,
};

export function usePeople() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: peopleKeys.list(userId),
    queryFn: async (): Promise<Person[]> => {
      const { data, error } = await supabase
        .from('people')
        .select('id, display_name, linked_user_id')
        .eq('owner_user_id', userId as string)
        .order('display_name');
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

/** Adds a placeholder person ("Dad"). Linking happens through invite links (see below). */
export function useAddPerson() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (displayName: string): Promise<Person> => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('people')
        .insert({ owner_user_id: userId, display_name: displayName.trim() })
        .select('id, display_name, linked_user_id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (person) => {
      queryClient.setQueryData<Person[]>(peopleKeys.list(userId), (prev) =>
        [...(prev ?? []), person].sort((a, b) => a.display_name.localeCompare(b.display_name)),
      );
    },
  });
}

// ---------------------------------------------------------------------------
// M6: companion records, invites, linking, imports, tags
// ---------------------------------------------------------------------------

export type CompanionRecord = Rpc<'companion_records'>[number];
export type CompanionGame = Rpc<'companion_games'>[number];
export type TaggedGame = Rpc<'tagged_games_for_me'>[number];

export type AcceptInviteResult =
  | { ok: true; owner_user_id: string; tagged_games: number }
  | { ok: false; reason: 'invalid' | 'own_invite' | 'blocked' | 'already_linked' | string };

export const companionKeys = {
  records: (userId: string | null) => ['people', 'records', userId] as const,
  games: (userId: string | null, personId: string) =>
    ['people', 'games', userId, personId] as const,
  taggedForMe: (userId: string | null, owner: string) =>
    ['people', 'tagged', userId, owner] as const,
  myTagsAtGame: (userId: string | null, gameId: string) =>
    ['people', 'myTags', userId, gameId] as const,
};

/** Companion list with records, sorted by games together (server order). */
export function useCompanionRecords() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: companionKeys.records(userId),
    queryFn: async (): Promise<CompanionRecord[]> => {
      const { data, error } = await supabase.rpc('companion_records');
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useCompanionGames(personId: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: companionKeys.games(userId, personId ?? ''),
    queryFn: async (): Promise<CompanionGame[]> => {
      const { data, error } = await supabase.rpc('companion_games', {
        p_person_id: personId as string,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!personId,
    staleTime: 60_000,
  });
}

function useInvalidatePeople() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: peopleKeys.all });
}

export function useRenamePerson() {
  const invalidate = useInvalidatePeople();
  return useMutation({
    mutationFn: async (input: { personId: string; displayName: string }) => {
      const name = input.displayName.trim();
      if (!name) throw new Error('Name cannot be empty');
      const { error } = await supabase
        .from('people')
        .update({ display_name: name })
        .eq('id', input.personId);
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

/** Deletes a person and, through the cascade, every tag of them on my games. */
export function useDeletePerson() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidatePeople();
  return useMutation({
    mutationFn: async (input: { personId: string }) => {
      const { error } = await supabase.from('people').delete().eq('id', input.personId);
      if (error) throw error;
    },
    onSettled: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['attendances'] });
    },
  });
}

/** Creates (or rotates) the invite token for a placeholder person. */
export function useCreatePersonInvite() {
  return useMutation({
    mutationFn: async (input: { personId: string }): Promise<string> => {
      const { data, error } = await supabase.rpc('create_person_invite', {
        p_person_id: input.personId,
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useAcceptPersonInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { token: string }): Promise<AcceptInviteResult> => {
      const { data, error } = await supabase.rpc('accept_person_invite', { p_token: input.token });
      if (error) throw error;
      const r = (data ?? {}) as Record<string, unknown>;
      if (r['ok'] === true) {
        return {
          ok: true,
          owner_user_id: String(r['owner_user_id']),
          tagged_games: Number(r['tagged_games'] ?? 0),
        };
      }
      return { ok: false, reason: typeof r['reason'] === 'string' ? r['reason'] : 'invalid' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.all });
      queryClient.invalidateQueries({ queryKey: ['social'] });
    },
  });
}

export function useTaggedGamesForMe(owner: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: companionKeys.taggedForMe(userId, owner ?? ''),
    queryFn: async (): Promise<TaggedGame[]> => {
      const { data, error } = await supabase.rpc('tagged_games_for_me', {
        p_owner: owner as string,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!owner,
    staleTime: 0,
  });
}

/** Imports the chosen tagged games as unverified attendances. Returns how many were created. */
export function useImportTaggedGames() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { owner: string; gameIds: string[] }): Promise<number> => {
      if (!input.gameIds.length) return 0;
      const { data, error } = await supabase.rpc('import_tagged_games', {
        p_owner: input.owner,
        p_game_ids: input.gameIds,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendances'] });
      queryClient.invalidateQueries({ queryKey: peopleKeys.all });
      queryClient.invalidateQueries({ queryKey: ['social'] });
    },
  });
}

/** Creates or reuses the people row linked to a user I follow, for tagging. */
export function usePersonForUser() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (input: { linkedUserId: string }): Promise<string> => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase.rpc('person_for_user', {
        p_owner: userId,
        p_linked: input.linkedUserId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.list(userId) }),
  });
}

export type MyTag = Rpc<'my_tags_at_game'>[number];

/**
 * Tags of me (via a linked person row) on other users' attendances for a game, with the owner's
 * name. The RPC sees tags even when the owner's attendances are hidden from me, because I am
 * always allowed to remove my own tag.
 */
export function useMyTagsAtGame(gameId: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: companionKeys.myTagsAtGame(userId, gameId ?? ''),
    queryFn: async (): Promise<MyTag[]> => {
      const { data, error } = await supabase.rpc('my_tags_at_game', {
        p_game_id: gameId as string,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!gameId,
    staleTime: 60_000,
  });
}

export function useRemoveMyTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { attendanceId: string; personId: string }) => {
      const { error } = await supabase
        .from('attendance_companions')
        .delete()
        .eq('attendance_id', input.attendanceId)
        .eq('person_id', input.personId);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['people', 'myTags'] });
      queryClient.invalidateQueries({ queryKey: ['social'] });
    },
  });
}
