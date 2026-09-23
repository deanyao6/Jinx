import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store';
import { supabase, type Rpc } from '@/lib/supabase';

export const communityKeys = {
  all: ['communities'] as const,
  list: (userId: string | null) => ['communities', 'list', userId] as const,
  detail: (slug: string | undefined) => ['communities', 'detail', slug] as const,
  leaderboard: (
    communityId: string | undefined,
    period: string,
    season: number,
    statKey: string,
    friendsOnly: boolean,
  ) => ['communities', 'leaderboard', communityId, period, season, statKey, friendsOnly] as const,
  feed: (communityId: string | undefined) => ['communities', 'feed', communityId] as const,
};

export const socialDataKeys = {
  badges: (userId: string | null) => ['social-data', 'badges', userId] as const,
  streaks: (userId: string | null) => ['social-data', 'streaks', userId] as const,
  counts: (userId: string | null) => ['social-data', 'counts', userId] as const,
  favorites: (userId: string | null) => ['social-data', 'favorites', userId] as const,
  seasonStatus: () => ['social-data', 'season-status'] as const,
};

// ---------------------------------------------------------------------------
// Communities: browse, join, leave
// ---------------------------------------------------------------------------

export type CommunityKind = 'team' | 'venue' | 'school' | 'custom';

export type CommunitySummary = {
  id: string;
  slug: string;
  name: string;
  kind: CommunityKind;
  member_count: number;
  team_id: string | null;
  venue_id: string | null;
  joined: boolean;
};

export function useCommunities() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: communityKeys.list(userId),
    queryFn: async (): Promise<CommunitySummary[]> => {
      const { data, error } = await supabase
        .from('communities')
        .select('id, slug, name, kind, member_count, team_id, venue_id')
        .order('member_count', { ascending: false });
      if (error) throw error;
      let mine = new Set<string>();
      if (userId) {
        const { data: memberships, error: mErr } = await supabase
          .from('community_members')
          .select('community_id')
          .eq('user_id', userId);
        if (mErr) throw mErr;
        mine = new Set(memberships.map((m) => m.community_id));
      }
      return (data as unknown as Omit<CommunitySummary, 'joined'>[]).map((c) => ({
        ...c,
        kind: c.kind as CommunityKind,
        joined: mine.has(c.id),
      }));
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export type CommunityDetail = CommunitySummary & {
  description: string | null;
  /** The sport its leaderboard stats are scoped to; null for a cross-sport school or custom one. */
  sport_id: string | null;
};

export function useCommunity(slug: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: communityKeys.detail(slug),
    queryFn: async (): Promise<CommunityDetail | null> => {
      const { data, error } = await supabase
        .from('communities')
        .select(
          'id, slug, name, kind, member_count, team_id, venue_id, description, team:teams(sport_id)',
        )
        .eq('slug', slug as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: membership, error: mErr } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('community_id', data.id)
        .eq('user_id', userId as string)
        .maybeSingle();
      if (mErr) throw mErr;
      let sportId = (data.team as { sport_id: string } | null)?.sport_id ?? null;
      if (!sportId && data.kind === 'venue' && data.venue_id) {
        const { data: venueTeam } = await supabase
          .from('teams')
          .select('sport_id')
          .eq('home_venue_id', data.venue_id)
          .limit(1)
          .maybeSingle();
        sportId = venueTeam?.sport_id ?? null;
      }
      const { team: _team, ...rest } = data;
      return { ...rest, kind: data.kind as CommunityKind, joined: !!membership, sport_id: sportId };
    },
    enabled: !!userId && !!slug,
    staleTime: 30_000,
  });
}

function useInvalidateCommunities() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: communityKeys.all });
}

export function useJoinCommunity() {
  const userId = useAuthStore((s) => s.userId);
  const invalidate = useInvalidateCommunities();
  return useMutation({
    mutationFn: async (input: { communityId: string }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('community_members')
        .insert({ community_id: input.communityId, user_id: userId });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export function useLeaveCommunity() {
  const userId = useAuthStore((s) => s.userId);
  const invalidate = useInvalidateCommunities();
  return useMutation({
    mutationFn: async (input: { communityId: string }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', input.communityId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Leaderboards
// ---------------------------------------------------------------------------

export type LeaderboardPeriod = 'season' | 'month' | 'all';
export type LeaderboardRow = Rpc<'community_leaderboard'>[number];

export function useCommunityLeaderboard(
  communityId: string | undefined,
  period: LeaderboardPeriod,
  season: number,
  statKey: string,
  friendsOnly: boolean,
) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: communityKeys.leaderboard(communityId, period, season, statKey, friendsOnly),
    queryFn: async (): Promise<LeaderboardRow[]> => {
      const { data, error } = await supabase.rpc('community_leaderboard', {
        p_community_id: communityId as string,
        p_period: period,
        p_season: season,
        p_stat_key: statKey,
        p_friends_only: friendsOnly,
        p_limit: 50,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!communityId,
    staleTime: 30_000,
  });
}

export function useSeasonStatus() {
  return useQuery({
    queryKey: socialDataKeys.seasonStatus(),
    queryFn: async (): Promise<Rpc<'season_status'>> => {
      const { data, error } = await supabase.rpc('season_status');
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Community feed: public posts filed under this community
// ---------------------------------------------------------------------------

export type CommunityFeedPost = {
  post_id: string;
  caption: string | null;
  created_at: string;
  author: { id: string; handle: string; display_name: string; avatar_path: string | null } | null;
};

export function useCommunityFeed(communityId: string | undefined) {
  return useQuery({
    queryKey: communityKeys.feed(communityId),
    queryFn: async (): Promise<CommunityFeedPost[]> => {
      const { data, error } = await supabase
        .from('community_posts')
        .select(
          'post_id, post:posts(id, caption, created_at, author:profiles(id, handle, display_name, avatar_path))',
        )
        .eq('community_id', communityId as string)
        .order('post_id', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (
        data as unknown as {
          post_id: string;
          post: {
            caption: string | null;
            created_at: string;
            author: CommunityFeedPost['author'];
          } | null;
        }[]
      )
        .filter((r) => r.post != null)
        .map((r) => ({
          post_id: r.post_id,
          caption: r.post!.caption,
          created_at: r.post!.created_at,
          author: r.post!.author,
        }));
    },
    enabled: !!communityId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export type Badge = {
  key: string;
  name: string;
  description: string;
  tier: 'standard' | 'rare' | 'legendary';
  sport_id: string | null;
  is_secret: boolean;
  earned_at: string | null;
};

export function useBadges(userId?: string) {
  const me = useAuthStore((s) => s.userId);
  const targetId = userId ?? me;
  return useQuery({
    queryKey: socialDataKeys.badges(targetId),
    queryFn: async (): Promise<Badge[]> => {
      const { data: badges, error } = await supabase
        .from('badges')
        .select('key, name, description, tier, sport_id, is_secret')
        .order('key');
      if (error) throw error;
      const { data: earned, error: earnedErr } = await supabase
        .from('user_badges')
        .select('badge_key, earned_at')
        .eq('user_id', targetId as string);
      if (earnedErr) throw earnedErr;
      const earnedMap = new Map(earned.map((e) => [e.badge_key, e.earned_at]));
      return (badges as unknown as Omit<Badge, 'earned_at'>[])
        .map((b) => ({ ...b, tier: b.tier as Badge['tier'], earned_at: earnedMap.get(b.key) ?? null }))
        .sort((a, b) => {
          if (!!a.earned_at !== !!b.earned_at) return a.earned_at ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
    },
    enabled: !!targetId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Season streaks
// ---------------------------------------------------------------------------

export type SeasonStreakRow = {
  team_id: string;
  team_name: string;
  sport_id: string;
  start_season: number;
  end_season: number;
  seasons: number;
  min_games: number;
  is_active: boolean;
};

export function useStreaks(userId?: string) {
  const me = useAuthStore((s) => s.userId);
  const targetId = userId ?? me;
  return useQuery({
    queryKey: socialDataKeys.streaks(targetId),
    queryFn: async (): Promise<SeasonStreakRow[]> => {
      const { data, error } = await supabase
        .from('season_streaks')
        .select('team_id, sport_id, start_season, end_season, seasons, min_games, is_active, team:teams(nickname)')
        .eq('user_id', targetId as string)
        .order('seasons', { ascending: false });
      if (error) throw error;
      return (
        data as unknown as (Omit<SeasonStreakRow, 'team_name'> & {
          team: { nickname: string | null } | null;
        })[]
      ).map((r) => ({ ...r, team_name: r.team?.nickname ?? 'Team' }));
    },
    enabled: !!targetId,
    staleTime: 60_000,
  });
}

export function useStreak(teamId: string | undefined, userId?: string) {
  const streaks = useStreaks(userId);
  return {
    ...streaks,
    data: streaks.data?.find((s) => s.team_id === teamId) ?? null,
  };
}

/** Season by season, for the streak detail screen. Self only: no `userId` override. */
export function useSeasonGameCounts(teamId: string | undefined) {
  return useQuery({
    queryKey: ['social-data', 'season-game-counts', teamId] as const,
    queryFn: async (): Promise<{ season: number; games: number }[]> => {
      const { data, error } = await supabase.rpc('my_season_game_counts', {
        p_team_id: teamId as string,
      });
      if (error) throw error;
      return (data as { season: number; games: number }[]).sort((a, b) => b.season - a.season);
    },
    enabled: !!teamId,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

export type CountRow = { sport_id: string; season: number; games: number; verified_games: number };

export function useCounts(userId?: string) {
  const me = useAuthStore((s) => s.userId);
  const targetId = userId ?? me;
  return useQuery({
    queryKey: socialDataKeys.counts(targetId),
    queryFn: async (): Promise<CountRow[]> => {
      const { data, error } = await supabase
        .from('user_counts')
        .select('sport_id, season, games, verified_games')
        .eq('user_id', targetId as string);
      if (error) throw error;
      return data;
    },
    enabled: !!targetId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Four favorite games
// ---------------------------------------------------------------------------

export type FavoriteGame = {
  ordinal: number;
  game_id: string;
  note: string | null;
  matchup: string;
  date: string;
  venue: string | null;
};

const FAVORITE_SELECT =
  'ordinal, game_id, note, game:games(scheduled_start, home_score, away_score, status, home:teams!games_home_team_id_fkey(nickname), away:teams!games_away_team_id_fkey(nickname), venue:venues(name))';

type FavoriteGameJoinRow = {
  ordinal: number;
  game_id: string;
  note: string | null;
  game: {
    scheduled_start: string;
    home_score: number | null;
    away_score: number | null;
    status: string;
    home: { nickname: string | null } | null;
    away: { nickname: string | null } | null;
    venue: { name: string | null } | null;
  } | null;
};

function toFavoriteGame(row: FavoriteGameJoinRow): FavoriteGame {
  const g = row.game;
  const home = g?.home?.nickname ?? 'Home';
  const away = g?.away?.nickname ?? 'Away';
  const matchup =
    g?.status === 'final' && g.home_score != null && g.away_score != null
      ? `${home} ${g.home_score}, ${away} ${g.away_score}`
      : `${away} at ${home}`;
  return {
    ordinal: row.ordinal,
    game_id: row.game_id,
    note: row.note,
    matchup,
    date: g?.scheduled_start ?? '',
    venue: g?.venue?.name ?? null,
  };
}

export function useFavoriteGames(userId?: string) {
  const me = useAuthStore((s) => s.userId);
  const targetId = userId ?? me;
  return useQuery({
    queryKey: socialDataKeys.favorites(targetId),
    queryFn: async (): Promise<FavoriteGame[]> => {
      const { data, error } = await supabase
        .from('favorite_games')
        .select(FAVORITE_SELECT)
        .eq('user_id', targetId as string)
        .order('ordinal');
      if (error) throw error;
      return (data as unknown as FavoriteGameJoinRow[]).map(toFavoriteGame);
    },
    enabled: !!targetId,
    staleTime: 30_000,
  });
}

export function useSetFavoriteGame() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ordinal: number; gameId: string; note?: string | null }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('favorite_games')
        .upsert(
          { user_id: userId, ordinal: input.ordinal, game_id: input.gameId, note: input.note ?? null },
          { onConflict: 'user_id,ordinal' },
        );
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: socialDataKeys.favorites(userId) }),
  });
}

export type PickableGame = {
  game_id: string;
  matchup: string;
  date: string;
};

/** The fan's own attended games, newest first, for the four-favorites picker. */
export function useMyAttendedGames() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: ['social-data', 'attended-games', userId] as const,
    queryFn: async (): Promise<PickableGame[]> => {
      const { data, error } = await supabase
        .from('attendances')
        .select(
          'game_id, game:games(scheduled_start, home_score, away_score, status, home:teams!games_home_team_id_fkey(nickname), away:teams!games_away_team_id_fkey(nickname))',
        )
        .eq('user_id', userId as string)
        .eq('status', 'attended')
        .order('game_id', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (
        data as unknown as {
          game_id: string;
          game: {
            scheduled_start: string;
            home_score: number | null;
            away_score: number | null;
            status: string;
            home: { nickname: string | null } | null;
            away: { nickname: string | null } | null;
          } | null;
        }[]
      )
        .filter((r) => r.game)
        .map((r) => {
          const g = r.game!;
          const home = g.home?.nickname ?? 'Home';
          const away = g.away?.nickname ?? 'Away';
          const matchup =
            g.status === 'final' && g.home_score != null && g.away_score != null
              ? `${home} ${g.home_score}, ${away} ${g.away_score}`
              : `${away} at ${home}`;
          return { game_id: r.game_id, matchup, date: g.scheduled_start };
        })
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useRemoveFavoriteGame() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ordinal: number }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('favorite_games')
        .delete()
        .eq('user_id', userId)
        .eq('ordinal', input.ordinal);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: socialDataKeys.favorites(userId) }),
  });
}
