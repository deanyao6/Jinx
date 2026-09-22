import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store';
import {
  GAME_TEAM_COLUMNS,
  gameKeys,
  type GameTeam,
  type GameVenue,
} from '@/features/games/queries';
import { supabase } from '@/lib/supabase';
import type { RootingBasis } from './rooting';

export type AttendanceGame = {
  id: string;
  sport_id: string;
  season: number;
  game_type: string;
  scheduled_start: string;
  status: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  is_tie: boolean;
  winner_team_id?: string | null;
  doubleheader_number: number | null;
  home: GameTeam | null;
  away: GameTeam | null;
  venue: GameVenue | null;
};

export type Seat = {
  section: string | null;
  row: string | null;
  seat: string | null;
  price_cents: number | null;
};

export type Attendance = {
  id: string;
  user_id: string;
  game_id: string;
  source: string;
  status: 'going' | 'attended';
  verified: boolean;
  verified_via: string | null;
  note: string | null;
  rooting_team_id: string | null;
  rooting_basis: string | null;
  created_at: string;
  game: AttendanceGame;
  seat: Seat | null;
  companions: { person: { id: string; display_name: string } | null }[];
};

const ATTENDANCE_SELECT = `id, user_id, game_id, source, status, verified, verified_via, note,
  rooting_team_id, rooting_basis, created_at,
  game:games(id, sport_id, season, game_type, scheduled_start, status, home_team_id, away_team_id,
    home_score, away_score, is_tie, winner_team_id, doubleheader_number,
    home:teams!games_home_team_id_fkey(${GAME_TEAM_COLUMNS}),
    away:teams!games_away_team_id_fkey(${GAME_TEAM_COLUMNS}),
    venue:venues(id, name, city, state)),
  seat:attendance_seats(section, row, seat, price_cents),
  companions:attendance_companions(person:people(id, display_name))`;

export const attendanceKeys = {
  all: ['attendances'] as const,
  list: (userId: string | null) => ['attendances', 'list', userId] as const,
  forGame: (userId: string | null, gameId: string) =>
    ['attendances', 'game', userId, gameId] as const,
};

function byGameDateDesc(a: Attendance, b: Attendance): number {
  return b.game.scheduled_start.localeCompare(a.game.scheduled_start);
}

export function useMyAttendances() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: attendanceKeys.list(userId),
    queryFn: async (): Promise<Attendance[]> => {
      const { data, error } = await supabase
        .from('attendances')
        .select(ATTENDANCE_SELECT)
        .eq('user_id', userId as string);
      if (error) throw error;
      return (data as unknown as Attendance[]).filter((a) => a.game != null).sort(byGameDateDesc);
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useMyAttendanceForGame(gameId: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: attendanceKeys.forGame(userId, gameId ?? ''),
    queryFn: async (): Promise<Attendance | null> => {
      const { data, error } = await supabase
        .from('attendances')
        .select(ATTENDANCE_SELECT)
        .eq('user_id', userId as string)
        .eq('game_id', gameId as string)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Attendance | null) ?? null;
    },
    enabled: !!userId && !!gameId,
    staleTime: 60_000,
  });
}

export type SeatInput = { section: string; row: string; seat: string; priceCents: number | null };

export type LogInput = {
  gameId: string;
  status: 'going' | 'attended';
  rootingTeamId: string | null;
  rootingBasis: RootingBasis | null;
  note: string;
  seat: SeatInput;
  companionIds: string[];
};

function seatIsEmpty(s: SeatInput): boolean {
  return !s.section.trim() && !s.row.trim() && !s.seat.trim() && s.priceCents == null;
}

function seatRow(attendanceId: string, s: SeatInput) {
  return {
    attendance_id: attendanceId,
    section: s.section.trim() || null,
    row: s.row.trim() || null,
    seat: s.seat.trim() || null,
    price_cents: s.priceCents,
  };
}

function useInvalidateAttendances() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return (gameId?: string) => {
    queryClient.invalidateQueries({ queryKey: attendanceKeys.list(userId) });
    if (gameId) queryClient.invalidateQueries({ queryKey: attendanceKeys.forGame(userId, gameId) });
    else queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    // Famous games and personal badges follow attendances. Spelled out rather than imported
    // from features/famous, the same way players/queries.ts does, to keep features apart.
    queryClient.invalidateQueries({ queryKey: ['famous'] });
  };
}

export function useLogAttendance() {
  const userId = useAuthStore((s) => s.userId);
  const invalidate = useInvalidateAttendances();
  return useMutation({
    mutationFn: async (input: LogInput): Promise<string> => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('attendances')
        .insert({
          user_id: userId,
          game_id: input.gameId,
          source: 'manual',
          status: input.status,
          note: input.note.trim() || null,
          rooting_team_id: input.rootingTeamId,
          rooting_basis: input.rootingBasis,
        })
        .select('id')
        .single();
      if (error) throw error;
      const attendanceId = data.id;
      if (!seatIsEmpty(input.seat)) {
        const { error: seatError } = await supabase
          .from('attendance_seats')
          .insert(seatRow(attendanceId, input.seat));
        if (seatError) throw seatError;
      }
      if (input.companionIds.length) {
        const { error: compError } = await supabase
          .from('attendance_companions')
          .insert(
            input.companionIds.map((person_id) => ({ attendance_id: attendanceId, person_id })),
          );
        if (compError) throw compError;
      }
      return attendanceId;
    },
    onSuccess: (_id, input) => invalidate(input.gameId),
  });
}

export type UpdateInput = LogInput & { attendanceId: string };

export function useUpdateAttendance() {
  const userId = useAuthStore((s) => s.userId);
  const invalidate = useInvalidateAttendances();
  return useMutation({
    mutationFn: async (input: UpdateInput): Promise<void> => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('attendances')
        .update({
          status: input.status,
          note: input.note.trim() || null,
          rooting_team_id: input.rootingTeamId,
          rooting_basis: input.rootingBasis,
        })
        .eq('id', input.attendanceId);
      if (error) throw error;

      if (seatIsEmpty(input.seat)) {
        const { error: seatError } = await supabase
          .from('attendance_seats')
          .delete()
          .eq('attendance_id', input.attendanceId);
        if (seatError) throw seatError;
      } else {
        const { error: seatError } = await supabase
          .from('attendance_seats')
          .upsert(seatRow(input.attendanceId, input.seat), { onConflict: 'attendance_id' });
        if (seatError) throw seatError;
      }

      const { error: delError } = await supabase
        .from('attendance_companions')
        .delete()
        .eq('attendance_id', input.attendanceId);
      if (delError) throw delError;
      if (input.companionIds.length) {
        const { error: compError } = await supabase.from('attendance_companions').insert(
          input.companionIds.map((person_id) => ({
            attendance_id: input.attendanceId,
            person_id,
          })),
        );
        if (compError) throw compError;
      }
    },
    onSuccess: (_v, input) => invalidate(input.gameId),
  });
}

export function useDeleteAttendance() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (input: { attendanceId: string; gameId: string }) => {
      const { error } = await supabase.from('attendances').delete().eq('id', input.attendanceId);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: attendanceKeys.list(userId) });
      const previous = queryClient.getQueryData<Attendance[]>(attendanceKeys.list(userId));
      queryClient.setQueryData<Attendance[]>(attendanceKeys.list(userId), (prev) =>
        (prev ?? []).filter((a) => a.id !== input.attendanceId),
      );
      queryClient.setQueryData(attendanceKeys.forGame(userId, input.gameId), null);
      return { previous };
    },
    onError: (_e, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(attendanceKeys.list(userId), ctx.previous);
    },
    onSettled: (_v, _e, input) => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.list(userId) });
      queryClient.invalidateQueries({ queryKey: attendanceKeys.forGame(userId, input.gameId) });
      queryClient.invalidateQueries({ queryKey: gameKeys.detail(input.gameId) });
      queryClient.invalidateQueries({ queryKey: ['famous'] });
    },
  });
}

export type BulkRow = {
  gameId: string;
  status: 'going' | 'attended';
  rootingTeamId: string | null;
  rootingBasis: RootingBasis | null;
};

/** Logs many games at once; games already logged are skipped by the unique (user, game) index. */
export function useBulkLogAttendances() {
  const userId = useAuthStore((s) => s.userId);
  const invalidate = useInvalidateAttendances();
  return useMutation({
    mutationFn: async (rows: BulkRow[]): Promise<number> => {
      if (!userId) throw new Error('Not signed in');
      if (!rows.length) return 0;
      const { data, error } = await supabase
        .from('attendances')
        .upsert(
          rows.map((r) => ({
            user_id: userId,
            game_id: r.gameId,
            source: 'manual',
            status: r.status,
            rooting_team_id: r.rootingTeamId,
            rooting_basis: r.rootingBasis,
          })),
          { onConflict: 'user_id,game_id', ignoreDuplicates: true },
        )
        .select('id');
      if (error) throw error;
      return data.length;
    },
    onSuccess: () => invalidate(),
  });
}
