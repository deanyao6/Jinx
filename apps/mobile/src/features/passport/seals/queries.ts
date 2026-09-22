import { useQuery } from '@tanstack/react-query';

import { attendanceKeys } from '@/features/attendances/queries';
import { useAuthStore } from '@/features/auth/store';
import { RARE_MOMENT_TYPES, type WitnessedGame } from '@/features/eggs/stamps';
import { supabase } from '@/lib/supabase';

import type { HomeTeam } from './look';
import { toWitnessedGame, type RareRow } from './witnessed';

/**
 * Which team plays at which stadium: `teams.home_venue_id`, which the bucket lists were
 * already built from (migration 20260915000900), so no schema change was needed.
 *
 * Its own query rather than one more column on `useTeams`: that list is persisted for a week,
 * and a copy restored from an older build has no `home_venue_id`, which would have drawn
 * every stamp in slate until it went stale.
 */
export function useVenueHomeTeams() {
  return useQuery({
    queryKey: ['teams', 'home-venues'] as const,
    queryFn: async (): Promise<HomeTeam[]> => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, franchise_id, home_venue_id, active')
        .eq('active', true)
        .not('home_venue_id', 'is', null);
      if (error) throw error;
      return data;
    },
    staleTime: 24 * 60 * 60_000,
  });
}

/**
 * The person's attended games where one of the rare event types happened, with the stadium.
 *
 * `game_events` is readable by anyone and joins through the game, the way `useMomentGames`
 * already reads it, so the golden stamp needs nothing the client could not already ask for.
 * Keyed under the attendance list so logging or removing a game refreshes it.
 */
export function useWitnessedRareGames(enabled = true) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: [...attendanceKeys.list(userId), 'rare-moments'] as const,
    queryFn: async (): Promise<WitnessedGame[]> => {
      const { data, error } = await supabase
        .from('attendances')
        .select(
          `rooting_team_id,
           game:games!inner(id, sport_id, venue_id, status, home_team_id, away_team_id,
             home_score, away_score, winner_team_id, events:game_events!inner(type))`,
        )
        .eq('user_id', userId as string)
        .eq('status', 'attended')
        .in('game.events.type', [...RARE_MOMENT_TYPES]);
      if (error) throw error;
      return (data as unknown as RareRow[]).filter((r) => r.game != null).map(toWitnessedGame);
    },
    enabled: !!userId && enabled,
    staleTime: 5 * 60_000,
  });
}
