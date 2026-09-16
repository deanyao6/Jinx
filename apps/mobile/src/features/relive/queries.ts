import { useQuery } from '@tanstack/react-query';

import type { ReliveStep } from '@/features/data/shapes';
import { supabase } from '@/lib/supabase';

/**
 * Relive's per-game data (SPEC.md 6.19), from the tables added with spec revision 7.
 *
 * Both are written after a game goes final, by the detail worker draining `detail_queue`.
 * A game whose detail has not arrived yet returns empty arrays, which is what the screen's
 * "Details arrive overnight" state is for (SPEC.md 4.7).
 */

export const reliveKeys = {
  wp: (gameId: string | undefined) => ['relive', 'wp', gameId] as const,
  steps: (gameId: string | undefined) => ['relive', 'steps', gameId] as const,
};

/** The home team's win probability at each point, ordered by `seq`. */
export function useGameWinProbability(gameId: string | undefined) {
  return useQuery({
    queryKey: reliveKeys.wp(gameId),
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await supabase
        .from('game_wp_timeline')
        .select('seq, home_wp')
        .eq('game_id', gameId as string)
        .order('seq');
      if (error) throw error;
      return (data as { seq: number; home_wp: number }[]).map((row) => Number(row.home_wp));
    },
    enabled: !!gameId,
    staleTime: 24 * 60 * 60_000,
  });
}

/** The story steps, ordered by `seq`. */
export function useGameStorySteps(gameId: string | undefined) {
  return useQuery({
    queryKey: reliveKeys.steps(gameId),
    queryFn: async (): Promise<ReliveStep[]> => {
      const { data, error } = await supabase
        .from('game_story_steps')
        .select('seq, wp_seq, away_score, home_score, label, text, scorer_player_id, scorer_name')
        .eq('game_id', gameId as string)
        .order('seq');
      if (error) throw error;
      return (
        data as {
          wp_seq: number;
          away_score: number;
          home_score: number;
          label: string;
          text: string;
          scorer_player_id: string | null;
          scorer_name: string | null;
        }[]
      ).map((row) => ({
        wp: row.wp_seq,
        // The reference writes the score with spaces around the dash, as it does records.
        score: `${row.away_score} – ${row.home_score}`,
        label: row.label,
        text: row.text,
        scorerId: row.scorer_player_id,
        scorerName: row.scorer_name,
      }));
    },
    enabled: !!gameId,
    staleTime: 24 * 60 * 60_000,
  });
}
