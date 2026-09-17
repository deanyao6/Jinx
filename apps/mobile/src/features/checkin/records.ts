import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/**
 * The season record under each badge on Pick a side (SPEC.md 8.8.3: "names and records").
 *
 * It was left blank because the game context does not carry it. It is derived here from the
 * same `games` rows everything else uses, so it cannot disagree with them: regular season only,
 * finals only, and only games that started before this one.
 */

export type RecordGame = {
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
};

/** "12-5", or "6-2-1" once there is a tie. Empty before the team has played. */
export function seasonRecord(games: readonly RecordGame[], teamId: string): string {
  let w = 0;
  let l = 0;
  let t = 0;
  for (const g of games) {
    if (g.home_score == null || g.away_score == null) continue;
    const isHome = g.home_team_id === teamId;
    if (!isHome && g.away_team_id !== teamId) continue;
    const mine = isHome ? g.home_score : g.away_score;
    const theirs = isHome ? g.away_score : g.home_score;
    if (mine > theirs) w += 1;
    else if (mine < theirs) l += 1;
    else t += 1;
  }
  if (w + l + t === 0) return '';
  // An en dash, as records are written everywhere else in the app (CLAUDE.md, Copy).
  const dash = String.fromCharCode(0x2013);
  return t > 0 ? `${w}${dash}${l}${dash}${t}` : `${w}${dash}${l}`;
}

export function useSeasonRecords(
  gameId: string | undefined,
  homeTeamId: string | undefined,
  awayTeamId: string | undefined,
) {
  return useQuery({
    queryKey: ['checkin', 'season-records', gameId],
    enabled: !!gameId && !!homeTeamId && !!awayTeamId,
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<{ home: string; away: string }> => {
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('season, sport_id, scheduled_start')
        .eq('id', gameId as string)
        .single();
      if (gameError) throw gameError;
      const ids = `(${homeTeamId},${awayTeamId})`;
      // Filtered on the server. Two teams play at most 324 regular-season games between them,
      // well inside PostgREST's 1000-row page, and nothing is filtered in memory afterwards.
      const { data, error } = await supabase
        .from('games')
        .select('home_team_id, away_team_id, home_score, away_score')
        .eq('sport_id', game.sport_id)
        .eq('season', game.season)
        .eq('game_type', 'regular')
        .eq('status', 'final')
        .lt('scheduled_start', game.scheduled_start)
        .or(`home_team_id.in.${ids},away_team_id.in.${ids}`)
        .limit(1000);
      if (error) throw error;
      const rows = (data ?? []) as RecordGame[];
      return {
        home: seasonRecord(rows, homeTeamId as string),
        away: seasonRecord(rows, awayTeamId as string),
      };
    },
  });
}
