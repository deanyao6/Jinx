import {
  evaluateGoal,
  validateGoalDefinition,
  type GoalDefinition,
  type GoalGame,
  type GoalProgress,
} from '@appname/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useAuthStore } from '@/features/auth/store';
import type { Json } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { stableJson, type GoalDraft } from './builder';

export type GoalRow = {
  id: string;
  user_id: string;
  year: number;
  title: string;
  definition: Json;
  source: string;
  progress: Json;
  completed_at: string | null;
  created_at: string;
};

export const goalKeys = {
  all: ['goals'] as const,
  list: (userId: string | null, year: number) => ['goals', 'list', userId, year] as const,
  games: (userId: string | null) => ['goals', 'games', userId] as const,
  inYear: (userId: string | null, year: number) => ['goals', 'inYear', userId, year] as const,
};

/** The GoalGame[] every goal and bucket list is evaluated against. */
export function useGoalGames() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: goalKeys.games(userId),
    queryFn: async (): Promise<GoalGame[]> => {
      const { data, error } = await supabase.rpc('goal_games', { p_user: userId as string });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as unknown as GoalGame[];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useGoals(year: number) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: goalKeys.list(userId, year),
    queryFn: async (): Promise<GoalRow[]> => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId as string)
        .eq('year', year)
        .order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useGamesInYear(year: number) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: goalKeys.inYear(userId, year),
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('games_in_year', { p_year: year });
      if (error) throw error;
      return data ?? 0;
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

export function useCreateGoal(year: number) {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: GoalDraft): Promise<GoalRow> => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('goals')
        .insert({
          user_id: userId,
          year,
          title: draft.title,
          definition: draft.definition as unknown as Json,
          source: draft.source,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.list(userId, year) });
    },
  });
}

export function useDeleteGoal(year: number) {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase.from('goals').delete().eq('id', goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.list(userId, year) });
    },
  });
}

export type EvaluatedGoal = {
  goal: GoalRow;
  definition: GoalDefinition | null;
  progress: GoalProgress | null;
};

/** Evaluates every goal client-side with the shared core evaluator. */
export function evaluateGoals(goals: GoalRow[], games: GoalGame[]): EvaluatedGoal[] {
  return goals.map((goal) => {
    const def = goal.definition;
    if (!validateGoalDefinition(def)) return { goal, definition: null, progress: null };
    return { goal, definition: def, progress: evaluateGoal(def, games) };
  });
}

/**
 * Keeps the server rows current: after computing progress, calls set_goal_progress for any goal whose
 * stored progress or completion differs. Each goal is synced at most once per distinct result.
 */
export function useSyncGoalProgress(evaluated: EvaluatedGoal[], year: number) {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const synced = useRef(new Map<string, string>());
  useEffect(() => {
    let changed = false;
    const jobs: Promise<unknown>[] = [];
    for (const { goal, progress } of evaluated) {
      if (!progress) continue;
      const wanted = stableJson(progress);
      const stored = stableJson(goal.progress);
      const completedStored = goal.completed_at != null;
      const upToDate = stored === wanted && completedStored === progress.completed;
      if (upToDate || synced.current.get(goal.id) === wanted) continue;
      synced.current.set(goal.id, wanted);
      changed = true;
      jobs.push(
        Promise.resolve(
          supabase.rpc('set_goal_progress', {
            p_goal_id: goal.id,
            p_progress: progress as unknown as Json,
            p_completed: progress.completed,
          }),
        ),
      );
    }
    if (!changed) return;
    void Promise.all(jobs).then(() => {
      queryClient.invalidateQueries({ queryKey: goalKeys.list(userId, year) });
    });
  }, [evaluated, queryClient, userId, year]);
}
