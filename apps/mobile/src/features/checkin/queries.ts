import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { attendanceKeys } from '@/features/attendances/queries';
import { useAuthStore } from '@/features/auth/store';
import { GAME_TEAM_COLUMNS, fetchGame, gameKeys, type GameDetail } from '@/features/games/queries';
import { clientLiveFeed, pollDelayMs } from '@/features/live/feeds';
import { supabase } from '@/lib/supabase';
import type { LiveState } from './lock';

export type ContextTeam = {
  team_id: string;
  name: string;
  favorite: boolean;
  win_prob: number | null;
};

export type GameContext = {
  game_id: string;
  sport_id: string;
  status: string;
  scheduled_start: string;
  final_at: string | null;
  home: ContextTeam;
  away: ContextTeam;
  /** MLS: the chance the match is drawn; the two sides' win_prob leave it out. Null elsewhere. */
  draw_prob?: number | null;
  venue: {
    venue_id: string | null;
    name: string | null;
    geofence_m: number | null;
    lat: number | null;
    lng: number | null;
  };
  neutral_for_user: boolean;
  both_favorites: boolean;
  check_in_opens_at: string;
  check_in_closes_at: string;
  estimated_lock_at: string | null;
  /** When the session started. The name is kept for the builds in the field. */
  checked_in_at: string | null;
  /**
   * The check-in as a session (migration 20260924000200). Absent from a server older than that
   * migration, which only knew open sessions.
   */
  checkin?: {
    started_at: string;
    ended_at: string | null;
    end_reason: 'final' | 'left' | 'timeout' | 'geofence_exit' | null;
    open: boolean;
    visibility: 'mutuals' | 'off';
    /** The per-game "not tonight" (migration 20260924020000). Absent from an older server. */
    prompts_muted?: boolean;
  } | null;
  attendance: {
    id: string;
    status: string;
    verified: boolean;
    rooting_team_id: string | null;
    rooting_basis: string | null;
  } | null;
  pledge: {
    team_id: string;
    pledged_at: string;
    status: string;
    result: string | null;
    win_prob_at_pledge: number;
    void_reason: string | null;
  } | null;
};

export type CheckInFailure = {
  ok: false;
  reason: 'too_far' | 'outside_window' | 'not_playing' | 'venue_unknown' | string;
  distance_m?: number;
  geofence_m?: number;
};
export type CheckInResult = ({ ok: true; attendance_id: string } & GameContext) | CheckInFailure;

export type PledgeFailure = {
  ok: false;
  reason: 'not_checked_in' | 'not_neutral' | 'game_over' | 'already_validated' | string;
};
export type PledgeResult = ({ ok: true } & GameContext) | PledgeFailure;

export const checkinKeys = {
  all: ['checkin'] as const,
  context: (userId: string | null, gameId: string) =>
    ['checkin', 'context', userId, gameId] as const,
  live: (gameId: string) => ['checkin', 'live', gameId] as const,
  pledge: (userId: string | null, gameId: string) => ['checkin', 'pledge', userId, gameId] as const,
  today: (userId: string | null, favIds: string[], loggedIds: string[]) =>
    ['checkin', 'today', userId, [...favIds].sort(), [...loggedIds].sort()] as const,
};

export async function fetchGameContext(gameId: string): Promise<GameContext | null> {
  const { data, error } = await supabase.rpc('game_context', { p_game_id: gameId });
  if (error) throw error;
  return (data as unknown as GameContext | null) ?? null;
}

export function useGameContext(gameId: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: checkinKeys.context(userId, gameId ?? ''),
    queryFn: () => fetchGameContext(gameId as string),
    enabled: !!userId && !!gameId,
    staleTime: 15_000,
  });
}

/**
 * Live state for a game under way. MLB reads `game_live_state`, which the server refreshes every
 * minute while anyone is checked in; the NBA and MLS read their public feeds from the phone
 * (features/live/feeds.ts, decision 8 of 2026-09-22), which never write to the database. Either
 * way the row has the same shape. Polled every 30 s while `enabled`, backing off to five
 * minutes when a feed fails, and a feed's `live` or `final` moves the cached game's status so
 * the game page follows without a refetch.
 */
export function useLiveState(
  gameId: string | undefined,
  sport: string | null | undefined,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const feed = clientLiveFeed(sport);
  return useQuery({
    queryKey: checkinKeys.live(gameId ?? ''),
    queryFn: async (): Promise<LiveState | null> => {
      if (feed) {
        const game = await queryClient.fetchQuery({
          queryKey: gameKeys.detail(gameId as string),
          queryFn: () => fetchGame(gameId as string),
          staleTime: 60_000,
        });
        const live = await feed.fetchLive(game);
        if (live && (live.status === 'live' || live.status === 'final')) {
          queryClient.setQueryData<GameDetail>(gameKeys.detail(gameId as string), (g) =>
            g && g.status !== live.status && g.status !== 'final' ? { ...g, status: live.status } : g,
          );
        }
        return live;
      }
      const { data, error } = await supabase
        .from('game_live_state')
        .select('*')
        .eq('game_id', gameId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!gameId && enabled,
    retry: false,
    refetchInterval: (query) => {
      if (!enabled) return false;
      const base = feed?.pollMs ?? 30_000;
      return query.state.status === 'error'
        ? pollDelayMs(base, query.state.fetchFailureCount)
        : base;
    },
    staleTime: 20_000,
  });
}

function useApplyContext() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return (gameId: string, ctx: GameContext) => {
    queryClient.setQueryData(checkinKeys.context(userId, gameId), ctx);
    queryClient.invalidateQueries({ queryKey: attendanceKeys.list(userId) });
    queryClient.invalidateQueries({ queryKey: attendanceKeys.forGame(userId, gameId) });
    queryClient.invalidateQueries({ queryKey: checkinKeys.pledge(userId, gameId) });
    queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) });
  };
}

export function useCheckIn() {
  const apply = useApplyContext();
  return useMutation({
    mutationFn: async (input: {
      gameId: string;
      distanceM: number;
      accuracyM: number;
    }): Promise<CheckInResult> => {
      const { data, error } = await supabase.rpc('check_in', {
        p_game_id: input.gameId,
        p_distance_m: Math.round(input.distanceM),
        p_accuracy_m: Math.round(input.accuracyM),
      });
      if (error) throw error;
      return data as unknown as CheckInResult;
    },
    onSuccess: (result, input) => {
      if (result.ok) apply(input.gameId, result);
    },
  });
}

export function useMakePledge() {
  const apply = useApplyContext();
  return useMutation({
    mutationFn: async (input: { gameId: string; teamId: string }): Promise<PledgeResult> => {
      const { data, error } = await supabase.rpc('make_pledge', {
        p_game_id: input.gameId,
        p_team_id: input.teamId,
      });
      if (error) throw error;
      return data as unknown as PledgeResult;
    },
    onSuccess: (result, input) => {
      if (result.ok) apply(input.gameId, result);
    },
  });
}

/** Side picker when both teams are favorites: writes the chosen side onto the attendance. */
export function useChooseSide() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (input: { attendanceId: string; gameId: string; teamId: string }) => {
      const { error } = await supabase
        .from('attendances')
        .update({ rooting_team_id: input.teamId, rooting_basis: 'chosen' })
        .eq('id', input.attendanceId);
      if (error) throw error;
    },
    onSuccess: (_v, input) => {
      queryClient.setQueryData<GameContext | null>(
        checkinKeys.context(userId, input.gameId),
        (prev) =>
          prev && prev.attendance
            ? {
                ...prev,
                attendance: {
                  ...prev.attendance,
                  rooting_team_id: input.teamId,
                  rooting_basis: 'chosen',
                },
              }
            : prev,
      );
      queryClient.invalidateQueries({ queryKey: attendanceKeys.list(userId) });
      queryClient.invalidateQueries({ queryKey: attendanceKeys.forGame(userId, input.gameId) });
    },
  });
}

/** Companions quick-tag on the check-in screen. Replaces the attendance's companion set. */
export function useSetCompanions() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (input: { attendanceId: string; gameId: string; personIds: string[] }) => {
      const { error: delError } = await supabase
        .from('attendance_companions')
        .delete()
        .eq('attendance_id', input.attendanceId);
      if (delError) throw delError;
      if (input.personIds.length) {
        const { error } = await supabase.from('attendance_companions').insert(
          input.personIds.map((person_id) => ({
            attendance_id: input.attendanceId,
            person_id,
          })),
        );
        if (error) throw error;
      }
    },
    onSuccess: (_v, input) => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.list(userId) });
      queryClient.invalidateQueries({ queryKey: attendanceKeys.forGame(userId, input.gameId) });
    },
  });
}

export type PledgeRow = {
  team_id: string;
  pledged_at: string;
  status: string;
  result: string | null;
  win_prob_at_pledge: number;
  void_reason: string | null;
};

/** The user's pledge for a game, for the game detail screen. */
export function usePledgeForGame(gameId: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: checkinKeys.pledge(userId, gameId ?? ''),
    queryFn: async (): Promise<PledgeRow | null> => {
      const { data, error } = await supabase
        .from('pledges')
        .select('team_id, pledged_at, status, result, win_prob_at_pledge, void_reason')
        .eq('user_id', userId as string)
        .eq('game_id', gameId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!gameId,
    staleTime: 60_000,
  });
}

export type TodayGame = Omit<GameDetail, 'venue'> & {
  venue: { id: string; name: string; city: string; state: string | null; tz: string | null } | null;
};

const TODAY_SELECT = `*,
  home:teams!games_home_team_id_fkey(${GAME_TEAM_COLUMNS}),
  away:teams!games_away_team_id_fkey(${GAME_TEAM_COLUMNS}),
  venue:venues(id, name, city, state, tz)`;

/**
 * Games within about a day of now that are either logged or involve a favorite team, with the
 * venue time zone so "today" can be decided on the venue's calendar.
 */
export function useNearbyDayGames(favIds: string[], loggedIds: string[]) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: checkinKeys.today(userId, favIds, loggedIds),
    queryFn: async (): Promise<TodayGame[]> => {
      const now = Date.now();
      const from = new Date(now - 30 * 60 * 60 * 1000).toISOString();
      const to = new Date(now + 30 * 60 * 60 * 1000).toISOString();
      const clauses: string[] = [];
      if (favIds.length) {
        const list = `(${favIds.join(',')})`;
        clauses.push(`home_team_id.in.${list}`, `away_team_id.in.${list}`);
      }
      if (loggedIds.length) clauses.push(`id.in.(${loggedIds.join(',')})`);
      if (!clauses.length) return [];
      const { data, error } = await supabase
        .from('games')
        .select(TODAY_SELECT)
        .gte('scheduled_start', from)
        .lte('scheduled_start', to)
        .or(clauses.join(','))
        .order('scheduled_start')
        .limit(20);
      if (error) throw error;
      return data as unknown as TodayGame[];
    },
    enabled: !!userId && (favIds.length > 0 || loggedIds.length > 0),
    staleTime: 5 * 60_000,
  });
}

