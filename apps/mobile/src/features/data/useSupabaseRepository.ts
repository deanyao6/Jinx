import { useMemo } from 'react';

import { useMyAttendances } from '@/features/attendances/queries';
import { useGoals } from '@/features/goals/queries';
import { useLatestWrapped, useMyStats } from '@/features/passport/queries';
import { useCompanionRecords } from '@/features/people/queries';
import { useFavoriteTeams, useProfile } from '@/features/profile/queries';
import { useOverlaps, useProfileView, useRivalries } from '@/features/social/queries';
import { useTeams } from '@/features/teams/queries';
import { useVenueShapes } from '@/features/venues/shapes';
import type { StatsPayload } from '@/features/passport/types';
import { env } from '@/lib/env';

import { demoRepository } from './demo';
import { emptyRepository } from './empty';
import type { ShapeKey } from './shapes';
import { lastGameLine, supabaseRepository, type ProfileAccount, type TeamRef } from './supabase';
import type { Repository, RepositoryStatus } from './types';

/** An all-zero passport, so a screen has a settled shape to render before the cache lands. */
const NO_STATS: StatsPayload = {
  totals: { games: 0, venues: 0, states: 0, countries: 0 },
  overall: { wins: 0, losses: 0, ties: 0 },
  teams: [],
  pledge: { record: { wins: 0, losses: 0, ties: 0 }, vs_expected: 0 },
  stamps: [],
  superlatives: {},
  streaks: { longest_win: 0, longest_loss: 0, current: 0 },
  moments: [],
  players_seen: 0,
  computed_at: null,
};

/**
 * Assembles the repository the app reads from: the signed-in user's own data.
 *
 * Demo mode (SPEC.md 8.9) is the one exception and it is a build flag, not a fallback. It
 * used to be what the app showed whenever the stats cache had not resolved, which meant a
 * user who had logged one game saw someone else's 31–17 record, 48 games, and four friends,
 * with no way to tell which parts were theirs. Real data is now the only thing a signed-in
 * user is ever shown; until it arrives the repository is empty and the screens say so,
 * which `status` lets them distinguish from having nothing logged.
 */
export function useSupabaseRepository(): { repository: Repository; status: RepositoryStatus } {
  const stats = useMyStats();
  const teams = useTeams(false);
  const shapes = useVenueShapes();
  const attendances = useMyAttendances();
  const companions = useCompanionRecords();
  const rivalries = useRivalries();
  const overlaps = useOverlaps();
  const profile = useProfile();
  const favorites = useFavoriteTeams();
  const profileView = useProfileView(profile.data?.handle);
  const goals = useGoals(new Date().getFullYear());
  const wrapped = useLatestWrapped();

  const profileRow = profile.data;
  const favoriteTeams = favorites.data;
  const viewCounts = profileView.data;
  const goalRows = goals.data;
  const wrappedRef = wrapped.data;
  const statsLoading = stats.isPending && stats.fetchStatus !== 'idle';

  return useMemo(() => {
    if (env.demo) return { repository: demoRepository, status: 'demo' };
    if (!stats.data && statsLoading) return { repository: emptyRepository, status: 'loading' };

    const teamRefs = new Map<string, TeamRef>();
    for (const team of teams.data ?? []) {
      teamRefs.set(team.id, {
        id: team.id,
        name: team.name,
        city: team.city,
        abbreviation: team.abbreviation,
      });
    }

    const shapeMap = new Map<string, ShapeKey>();
    for (const row of shapes.data ?? []) shapeMap.set(row.venue_id, row.shape_key);

    // useMyAttendances sorts by game date descending, so the first attended game is the
    // most recent one.
    const latest = (attendances.data ?? []).find((a) => a.status === 'attended');

    const account: ProfileAccount | null = profileRow
      ? {
          handle: profileRow.handle,
          displayName: profileRow.display_name,
          homeCity: profileRow.home_city,
          avatarKey: profileRow.id,
          favorites: (favoriteTeams ?? []).map((t) => ({ id: t.id, name: t.name, city: t.city })),
          followers: viewCounts?.followers ?? null,
          following: viewCounts?.following ?? null,
          goals: goalRows
            ? {
                total: goalRows.length,
                done: goalRows.filter((g) => g.completed_at != null).length,
              }
            : null,
          wrapped: wrappedRef ? { sport_id: wrappedRef.sport_id, season: wrappedRef.season } : null,
        }
      : null;

    return {
      repository: supabaseRepository({
        stats: stats.data ?? NO_STATS,
        account,
        teams: teamRefs,
        shapes: shapeMap,
        lastGame: latest ? lastGameLine(latest.game) : null,
        lastGameId: latest?.game.id ?? null,
        attendances: (attendances.data ?? []).filter((a) => a.status === 'attended'),
        companions: companions.data ?? [],
        rivalries: rivalries.data ?? [],
        overlaps: overlaps.data ?? [],
      }),
      status: 'ready',
    };
  }, [
    stats.data,
    statsLoading,
    teams.data,
    shapes.data,
    attendances.data,
    companions.data,
    rivalries.data,
    overlaps.data,
    profileRow,
    favoriteTeams,
    viewCounts,
    goalRows,
    wrappedRef,
  ]);
}
