import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export const TEAM_COLUMNS = 'id, sport_id, name, city, abbreviation, franchise_id, active';

export type Team = {
  id: string;
  sport_id: string;
  name: string;
  city: string;
  abbreviation: string;
  franchise_id: string;
  active: boolean;
};

export const teamKeys = {
  all: ['teams'] as const,
  list: (activeOnly: boolean) => ['teams', 'list', activeOnly] as const,
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
