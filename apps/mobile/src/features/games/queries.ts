import type { ScoringRow } from '@jinx/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { supabase, type Rpc } from '@/lib/supabase';

export const GAME_TEAM_COLUMNS = 'id, name, nickname, abbreviation, sport_id, franchise_id';

/** Game row with both teams and the venue embedded. */
export const GAME_DETAIL_SELECT = `*,
  home:teams!games_home_team_id_fkey(${GAME_TEAM_COLUMNS}),
  away:teams!games_away_team_id_fkey(${GAME_TEAM_COLUMNS}),
  venue:venues(id, name, city, state)`;

export type GameTeam = {
  id: string;
  name: string;
  /** `teams.nickname`: "Mets". Optional because rows cached before it was selected lack it. */
  nickname?: string | null;
  abbreviation: string;
  sport_id: string;
  franchise_id: string;
};

export type GameVenue = { id: string; name: string; city: string; state: string | null };

export type GameDetail = {
  id: string;
  /** The provider's id: an MLB gamePk, or an nflverse id such as `2025_13_CHI_PHI`. */
  provider_game_id?: string | null;
  sport_id: string;
  season: number;
  season_key?: string | null;
  season_label?: string | null;
  decision_method?: string | null;
  home_shootout_score?: number | null;
  away_shootout_score?: number | null;
  game_type: string;
  scheduled_start: string;
  status: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  winner_team_id: string | null;
  is_tie: boolean;
  doubleheader_number: number | null;
  rescheduled_from_game_id: string | null;
  rescheduled_to_game_id: string | null;
  venue_id: string | null;
  temperature_f: number | null;
  duration_minutes: number | null;
  attendance: number | null;
  innings_or_periods: number | null;
  home: GameTeam | null;
  away: GameTeam | null;
  venue: GameVenue | null;
};

export type GameSearchHit = Rpc<'search_games'>[number];
export type TeamSeasonGame = Rpc<'team_season_games'>[number];

export type GameSearchParams = {
  query: string;
  sport: string | null;
  season: number | null;
  from: string | null;
  to: string | null;
  teamId: string | null;
  venueId: string | null;
};

export const gameKeys = {
  all: ['games'] as const,
  detail: (id: string) => ['games', 'detail', id] as const,
  search: (p: GameSearchParams) => ['games', 'search', p] as const,
  teamSeason: (teamId: string, season: number, homeOnly: boolean) =>
    ['games', 'teamSeason', teamId, season, homeOnly] as const,
  upcoming: (teamIds: string[]) => ['games', 'upcoming', [...teamIds].sort()] as const,
  events: (id: string) => ['games', 'events', id] as const,
  appearances: (id: string) => ['games', 'appearances', id] as const,
  scoring: (id: string) => ['games', 'scoring', id] as const,
};

export async function fetchGame(gameId: string): Promise<GameDetail> {
  const { data, error } = await supabase
    .from('games')
    .select(GAME_DETAIL_SELECT)
    .eq('id', gameId)
    .single();
  if (error) throw error;
  return data as unknown as GameDetail;
}

export function useGame(gameId: string | undefined) {
  return useQuery({
    queryKey: gameKeys.detail(gameId ?? ''),
    queryFn: () => fetchGame(gameId as string),
    enabled: !!gameId,
    staleTime: 60_000,
  });
}

export function hasSearchInput(p: GameSearchParams): boolean {
  return !!(p.query.trim() || p.sport || p.season || p.from || p.to || p.teamId || p.venueId);
}

export function useSearchGames(params: GameSearchParams, enabled = true) {
  return useQuery({
    queryKey: gameKeys.search(params),
    queryFn: async (): Promise<GameSearchHit[]> => {
      const { data, error } = await supabase.rpc('search_games', {
        p_query: params.query.trim() || undefined,
        p_sport: params.sport ?? undefined,
        p_season: params.season ?? undefined,
        p_from: params.from ?? undefined,
        p_to: params.to ?? undefined,
        p_team_id: params.teamId ?? undefined,
        p_venue_id: params.venueId ?? undefined,
        p_limit: 100,
      });
      if (error) throw error;
      return data;
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useTeamSeasonGames(
  teamId: string | null,
  season: number | null,
  homeOnly: boolean,
) {
  return useQuery({
    queryKey: gameKeys.teamSeason(teamId ?? '', season ?? 0, homeOnly),
    queryFn: async (): Promise<TeamSeasonGame[]> => {
      const { data, error } = await supabase.rpc('team_season_games', {
        p_team_id: teamId as string,
        p_season: season as number,
        p_home_only: homeOnly,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!teamId && !!season,
    staleTime: 60_000,
  });
}

/** Games for the given teams in the next 14 days. */
export function useUpcomingGames(teamIds: string[]) {
  return useQuery({
    queryKey: gameKeys.upcoming(teamIds),
    queryFn: async (): Promise<GameDetail[]> => {
      const now = new Date();
      const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const list = `(${teamIds.join(',')})`;
      const { data, error } = await supabase
        .from('games')
        .select(GAME_DETAIL_SELECT)
        .gte('scheduled_start', now.toISOString())
        .lte('scheduled_start', horizon.toISOString())
        .or(`home_team_id.in.${list},away_team_id.in.${list}`)
        .order('scheduled_start')
        .limit(60);
      if (error) throw error;
      return data as unknown as GameDetail[];
    },
    enabled: teamIds.length > 0,
    staleTime: 5 * 60_000,
  });
}

export type GameEventRow = {
  id: string;
  type: string;
  team_id: string | null;
  occurred_at: string | null;
  detail: Record<string, unknown>;
  player: { id: string; full_name: string } | null;
};

export function useGameEvents(gameId: string | undefined) {
  return useQuery({
    queryKey: gameKeys.events(gameId ?? ''),
    queryFn: async (): Promise<GameEventRow[]> => {
      const { data, error } = await supabase
        .from('game_events')
        .select('id, type, team_id, occurred_at, detail, player:players(id, full_name)')
        .eq('game_id', gameId as string)
        .order('occurred_at', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as unknown as GameEventRow[];
    },
    enabled: !!gameId,
    staleTime: 10 * 60_000,
  });
}

export type AppearanceRow = {
  team_id: string;
  player: { id: string; full_name: string } | null;
};

export function useGameAppearances(gameId: string | undefined) {
  return useQuery({
    queryKey: gameKeys.appearances(gameId ?? ''),
    queryFn: async (): Promise<AppearanceRow[]> => {
      const { data, error } = await supabase
        .from('game_appearances')
        .select('team_id, player:players(id, full_name)')
        .eq('game_id', gameId as string);
      if (error) throw error;
      return data as unknown as AppearanceRow[];
    },
    enabled: !!gameId,
    staleTime: 10 * 60_000,
  });
}

/**
 * Every scoring play of a game, oldest first, with who scored (SPEC.md 5.1). Written by the
 * detail worker; empty until then, and an empty answer is not cached for long, for the reason
 * given in features/relive/queries.ts.
 */
export function useGameScoring(gameId: string | undefined) {
  return useQuery({
    queryKey: gameKeys.scoring(gameId ?? ''),
    queryFn: async (): Promise<ScoringRow[]> => {
      const { data, error } = await supabase
        .from('game_scoring_timeline')
        .select(
          'seq, period, half, clock, home_score, away_score, scoring_side, description, kind, scorer_player_id, scorer_name',
        )
        .eq('game_id', gameId as string)
        .order('seq');
      if (error) throw error;
      return data.map((row) => ({
        seq: row.seq,
        period: row.period,
        half: row.half === 'top' || row.half === 'bottom' ? row.half : null,
        clock: row.clock,
        homeScore: row.home_score,
        awayScore: row.away_score,
        scoringSide: row.scoring_side === 'home' ? 'home' : 'away',
        description: row.description,
        kind: row.kind,
        scorerPlayerId: row.scorer_player_id,
        scorerName: row.scorer_name,
      }));
    },
    enabled: !!gameId,
    staleTime: (query) => ((query.state.data?.length ?? 0) > 0 ? 24 * 60 * 60_000 : 30_000),
  });
}
