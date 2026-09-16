import { useMemo } from 'react';

import { useMyAttendances } from '@/features/attendances/queries';
import { useMyStats } from '@/features/passport/queries';
import { useTeams } from '@/features/teams/queries';
import { useVenueShapes } from '@/features/venues/shapes';

import { demoRepository } from './demo';
import type { ShapeKey } from './shapes';
import { lastGameLine, supabaseRepository, type TeamRef } from './supabase';
import type { Repository } from './types';

/**
 * Assembles the Supabase-backed repository from the queries that feed it.
 *
 * Until the stats cache has resolved there is nothing real to show, so this returns the
 * demo repository rather than an empty passport. That is the difference between a screen
 * that is loading and one that says you have never been to a game.
 */
export function useSupabaseRepository(): { repository: Repository; ready: boolean } {
  const stats = useMyStats();
  const teams = useTeams(false);
  const shapes = useVenueShapes();
  const attendances = useMyAttendances();

  return useMemo(() => {
    if (!stats.data) return { repository: demoRepository, ready: false };

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

    return {
      repository: supabaseRepository({
        stats: stats.data,
        teams: teamRefs,
        shapes: shapeMap,
        lastGame: latest ? lastGameLine(latest.game) : null,
        attendances: (attendances.data ?? []).filter((a) => a.status === 'attended'),
      }),
      ready: true,
    };
  }, [stats.data, teams.data, shapes.data, attendances.data]);
}
