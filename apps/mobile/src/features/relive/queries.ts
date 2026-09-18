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

/**
 * How long a Relive answer stays fresh, which depends entirely on WHAT the answer was.
 *
 * A story that exists is finished history and never changes, so it is cached for a day and
 * the query client persists it across launches. An EMPTY result is not an answer, it is
 * "the detail worker has not got to this game yet" (SPEC.md 4.7) — and caching that for a
 * day is how a game stays permanently un-relivable: open it once before its story lands and
 * the app keeps telling you there is nothing for the next 24 hours, across restarts,
 * because the cache is persisted. That is exactly what happened to a real game here.
 *
 * So an empty result goes stale in half a minute and is asked again on the next visit.
 */
function reliveStaleTime(rows: readonly unknown[] | undefined): number {
  return (rows?.length ?? 0) > 0 ? 24 * 60 * 60_000 : 30_000;
}

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
    staleTime: (query) => reliveStaleTime(query.state.data),
  });
}

/** The story steps, ordered by `seq`. */
export function useGameStorySteps(gameId: string | undefined) {
  return useQuery({
    queryKey: reliveKeys.steps(gameId),
    queryFn: async (): Promise<ReliveStep[]> => {
      const { data, error } = await supabase
        .from('game_story_steps')
        .select(
          'seq, wp_seq, away_score, home_score, label, text, kind, scorer_player_id, scorer_name',
        )
        .eq('game_id', gameId as string)
        .order('seq');
      if (error) throw error;
      const rows = data as {
        wp_seq: number;
        away_score: number;
        home_score: number;
        label: string;
        text: string;
        kind: string | null;
        scorer_player_id: string | null;
        scorer_name: string | null;
      }[];
      return rows.map((row, i) => {
        const prev = rows[i - 1];
        const before = prev ? prev.away_score + prev.home_score : 0;
        return {
          wp: row.wp_seq,
          // The reference writes the score with spaces around the dash, as it does records.
          score: `${row.away_score} – ${row.home_score}`,
          label: row.label,
          text: row.text,
          scorerId: row.scorer_player_id,
          scorerName: row.scorer_name,
          kind: row.kind,
          runs: Math.max(0, row.away_score + row.home_score - before),
        };
      });
    },
    enabled: !!gameId,
    staleTime: (query) => reliveStaleTime(query.state.data),
  });
}
