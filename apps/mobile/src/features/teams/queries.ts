import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { TeamTokens } from '@/theme/reference/teams';

import { TEAM_COLOR_COLUMNS, toTeamTokens, type TeamColorsRow } from './palettes';

export const TEAM_COLUMNS =
  'id, sport_id, name, city, nickname, abbreviation, franchise_id, active';

export type Team = {
  id: string;
  sport_id: string;
  name: string;
  city: string;
  nickname: string | null;
  abbreviation: string;
  franchise_id: string;
  active: boolean;
};

export const teamPaletteKeys = {
  all: ['team-colors'] as const,
};

/**
 * Every team's palette, keyed by team id (SPEC.md 5.1, 8.2).
 *
 * 65 rows covering every MLB and NFL team. Without these, only the 14 palettes the
 * reference itself defines are available and every other team renders in the neutral grey
 * theme. The table is small and effectively static, so it is fetched once and kept a day.
 *
 * The result is a Map, which is not JSON, so `app/_layout.tsx` excludes it from the
 * persisted query cache. That costs one small request on a cold start.
 */
export function useTeamPalettes() {
  return useQuery({
    queryKey: teamPaletteKeys.all,
    queryFn: async (): Promise<Map<string, TeamTokens>> => {
      const { data, error } = await supabase.from('team_colors').select(TEAM_COLOR_COLUMNS);
      if (error) throw error;
      const map = new Map<string, TeamTokens>();
      for (const row of data as TeamColorsRow[]) map.set(row.team_id, toTeamTokens(row));
      return map;
    },
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });
}

export const teamKeys = {
  all: ['teams'] as const,
  // Invalidate persisted pre-MLS catalogs when this release first opens.
  list: (activeOnly: boolean) => ['teams', 'list', activeOnly, 'mls-v1'] as const,
  search: (query: string, sport: string | null) => ['teams', 'search', query, sport] as const,
};

export function useTeams(activeOnly = false) {
  return useQuery({
    queryKey: teamKeys.list(activeOnly),
    queryFn: async (): Promise<Team[]> => {
      let q = supabase.from('teams').select(TEAM_COLUMNS).order('sport_id').order('name');
      if (activeOnly) q = q.eq('active', true);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    staleTime: 24 * 60 * 60_000,
  });
}

export function useTeamsById() {
  const teams = useTeams(false);
  const map = new Map<string, Team>();
  for (const t of teams.data ?? []) map.set(t.id, t);
  return { ...teams, byId: map };
}

export type TeamSearchHit = {
  id: string;
  sport_id: string;
  name: string;
  city: string;
  abbreviation: string;
  active: boolean;
};

export function useSearchTeams(query: string, sport: string | null) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: teamKeys.search(trimmed.toLowerCase(), sport),
    queryFn: async (): Promise<TeamSearchHit[]> => {
      const { data, error } = await supabase.rpc('search_teams', {
        p_query: trimmed,
        p_sport: sport ?? undefined,
        p_limit: 8,
      });
      if (error) throw error;
      return data;
    },
    enabled: trimmed.length >= 2,
    staleTime: 60_000,
  });
}

/** Plain team name, never a logo or mark. `name` already includes the market ("Philadelphia Phillies"). */
export function teamLabel(t: { name: string }): string {
  return t.name;
}
