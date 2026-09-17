import { useQuery } from '@tanstack/react-query';

import { storylineSource } from '@/features/data/supabase';
import { supabase } from '@/lib/supabase';

/**
 * Pregame storylines for one game (SPEC.md 6.18), as written by the `storylines` Edge Function.
 *
 * At most one per team and one about the game, which the database enforces with a unique index,
 * so this never has to decide between two storylines for the same side.
 */

export type StorylineRow = { team_id: string | null; text: string; source: string };

export type StorylineCard = { key: string; text: string; source: string };

/**
 * The order they read in: why the game matters first, then the visitors, then the hosts.
 *
 * The significance line only exists for a big game, and when it does it is the headline. The
 * two teams then follow the scorebug's own order, away before home, so a storyline sits on the
 * same side of the screen as the team it is about.
 */
export function storylineCards(
  rows: readonly StorylineRow[],
  teams: { home: string | null; away: string | null },
): StorylineCard[] {
  const rank = (r: StorylineRow) =>
    r.team_id == null ? 0 : r.team_id === teams.away ? 1 : r.team_id === teams.home ? 2 : 3;
  return [...rows]
    .sort((a, b) => rank(a) - rank(b))
    .map((r) => ({
      key: r.team_id ?? 'game',
      text: r.text,
      source: storylineSource(r.source),
    }));
}

export const storylineKeys = {
  game: (gameId: string | undefined) => ['storylines', gameId] as const,
};

export function useStorylines(gameId: string | undefined) {
  return useQuery({
    queryKey: storylineKeys.game(gameId),
    queryFn: async (): Promise<StorylineRow[]> => {
      const { data, error } = await supabase
        .from('storylines')
        .select('team_id, text, source')
        .eq('game_id', gameId as string);
      if (error) throw error;
      return (data ?? []) as StorylineRow[];
    },
    enabled: !!gameId,
    // Refreshed an hour before the start (SPEC 6.18), so an hour-old copy is never far behind.
    staleTime: 30 * 60_000,
  });
}
