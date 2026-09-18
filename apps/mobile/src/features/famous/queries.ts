import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuthStore } from '@/features/auth/store';
import { env } from '@/lib/env';
import { supabase, type Rpc } from '@/lib/supabase';
import type { FamousItem, FamousListItem } from './format';

export const famousKeys = {
  all: ['famous'] as const,
  mine: (userId: string | null) => ['famous', 'mine', userId] as const,
  game: (userId: string | null, gameId: string) => ['famous', 'game', userId, gameId] as const,
  stars: (gameId: string) => ['famous', 'stars', gameId] as const,
};

function toListItem(r: Rpc<'my_famous_games'>[number]): FamousListItem {
  return {
    gameId: r.game_id,
    source: r.source,
    category: r.category,
    kind: r.kind,
    title: r.title,
    story: r.story,
    personal: r.personal,
    playerName: r.player_name ?? null,
    teamId: r.team_id ?? null,
    teamNickname: r.team_nickname ?? null,
    sportId: r.sport_id,
    scheduledStart: r.scheduled_start,
    away: r.away,
    home: r.home,
    awayScore: r.away_score ?? null,
    homeScore: r.home_score ?? null,
  };
}

/**
 * My famous games and personal badges, aggregated on the server. Never in demo mode: the
 * demo passport is fixture art and must not change (npm run parity).
 */
export function useMyFamousGames() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: famousKeys.mine(userId),
    queryFn: async (): Promise<FamousListItem[]> => {
      const { data, error } = await supabase.rpc('my_famous_games');
      if (error) throw error;
      return (data ?? []).map(toListItem);
    },
    enabled: !!userId && !env.demo,
    staleTime: 60_000,
  });
}

/** The ids of my famous games, for the gold mark on game rows. Empty until loaded. */
export function useMyFamousGameIds(): ReadonlySet<string> {
  const { data } = useMyFamousGames();
  return useMemo(() => new Set((data ?? []).map((d) => d.gameId)), [data]);
}

/** A game's famous rows, and my personal badges for it. */
export function useGameFamous(gameId: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: famousKeys.game(userId, gameId ?? ''),
    queryFn: async (): Promise<FamousItem[]> => {
      const { data, error } = await supabase.rpc('game_famous', { p_game_id: gameId as string });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        gameId: gameId as string,
        source: r.source,
        category: r.category,
        kind: r.kind,
        title: r.title,
        story: r.story,
        personal: r.personal,
        playerName: r.player_name ?? null,
        teamId: r.team_id ?? r.about_team_id ?? null,
        teamNickname: r.team_nickname ?? null,
        // The caller knows the game's sport; game_famous does not repeat it.
        sportId: '',
      }));
    },
    enabled: !!gameId && !!userId && !env.demo,
    staleTime: 5 * 60_000,
  });
}

export type GameStar = { playerId: string; name: string; teamId: string; label: string; season: number; seasonFirst: boolean };

/** The superstars who appeared in a game, with the honor that makes each one a star. */
export function useGameStars(gameId: string | undefined) {
  return useQuery({
    queryKey: famousKeys.stars(gameId ?? ''),
    queryFn: async (): Promise<GameStar[]> => {
      const { data, error } = await supabase.rpc('game_stars', { p_game_id: gameId as string });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        playerId: r.player_id,
        name: r.full_name,
        teamId: r.team_id,
        label: r.label,
        season: r.season,
        seasonFirst: r.season_first,
      }));
    },
    enabled: !!gameId && !env.demo,
    staleTime: 10 * 60_000,
  });
}
