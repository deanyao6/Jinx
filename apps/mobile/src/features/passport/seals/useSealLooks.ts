import { useCallback, useMemo } from 'react';

import { eggs } from '@/features/eggs/flags';
import { goldenVenueIds } from '@/features/eggs/stamps';
import { useMyStats } from '@/features/passport/queries';
import { useFavoriteTeams } from '@/features/profile/queries';
import { useTeamPalettes } from '@/features/teams/queries';
import { useTheme } from '@/theme/ThemeProvider';

import { sealLook, teamForVenue, type SealLook } from './look';
import { useVenueHomeTeams, useWitnessedRareGames } from './queries';

/**
 * How to draw the stamp of any stadium, for the signed-in person.
 *
 * Returns a function rather than a map because the callers know venues this does not: a
 * bucket list draws stadiums the person has a seal for but no stats row yet.
 *
 * Every input is a cached query the app already runs (palettes, favourites, stats) or a small
 * one added for this (home venues, rare games), so calling this from each seal on a page costs
 * observers, not requests. While anything is still loading a seal falls back gracefully: no
 * home teams or palettes yet means slate, no rare games yet means not gold.
 *
 * `scheme` overrides the appearance, for a region pinned to one (a Wrapped card).
 */
export function useSealLooks(scheme?: 'light' | 'dark') {
  const theme = useTheme();
  const resolved = scheme ?? theme.scheme;
  const palettes = useTeamPalettes().data;
  const homeTeams = useVenueHomeTeams().data;
  const favourites = useFavoriteTeams().data;
  const stamps = useMyStats().data?.stamps;
  const rare = useWitnessedRareGames(eggs.goldenStamps).data;

  const golden = useMemo(() => goldenVenueIds(rare ?? []), [rare]);
  const visitsByVenue = useMemo(
    () => new Map((stamps ?? []).map((s) => [s.venue_id, s.visits] as const)),
    [stamps],
  );

  return useCallback(
    (venueId: string, visits?: number | null): SealLook => {
      const teamId = teamForVenue(venueId, homeTeams ?? [], favourites ?? []);
      return sealLook({
        teamId,
        tokens: teamId ? palettes?.get(teamId) : null,
        scheme: resolved,
        visits: visits ?? visitsByVenue.get(venueId),
        golden: golden.has(venueId),
      });
    },
    [homeTeams, favourites, palettes, resolved, visitsByVenue, golden],
  );
}
