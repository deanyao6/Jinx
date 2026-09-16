/**
 * Rooting side for an attended game (SPEC.md 6.1).
 * Favorites are matched by franchise so relocated or renamed teams (St. Louis Rams -> Los Angeles
 * Rams, Montreal Expos -> Washington Nationals) count for the same favorite.
 */

export type RootingBasis = 'favorite' | 'chosen' | 'pledge';

export interface RootingInput {
  homeTeamId: string;
  awayTeamId: string;
  /** Team id -> franchise id. */
  franchiseOf: (teamId: string) => string;
  /** Franchise ids the user follows, evaluated as of now (SPEC 6.1.4). */
  favoriteFranchiseIds: Iterable<string>;
  /** The side the user chose when both teams are favorites. */
  chosenTeamId?: string | null | undefined;
  /** Team id of a valid (or provisional) pledge for this game. */
  pledgeTeamId?: string | null | undefined;
  /** Whether that pledge is valid. Provisional pledges do not give a side until validated. */
  pledgeValid?: boolean | undefined;
}

export interface RootingResult {
  teamId: string | null;
  basis: RootingBasis | null;
  /** True when the user follows both teams and has not chosen yet. */
  needsChoice: boolean;
}

export function rootingSide(input: RootingInput): RootingResult {
  const favs = new Set(input.favoriteFranchiseIds);
  const homeFav = favs.has(input.franchiseOf(input.homeTeamId));
  const awayFav = favs.has(input.franchiseOf(input.awayTeamId));

  if (homeFav && awayFav) {
    if (input.chosenTeamId === input.homeTeamId || input.chosenTeamId === input.awayTeamId) {
      return { teamId: input.chosenTeamId, basis: 'chosen', needsChoice: false };
    }
    return { teamId: null, basis: null, needsChoice: true };
  }
  if (homeFav) return { teamId: input.homeTeamId, basis: 'favorite', needsChoice: false };
  if (awayFav) return { teamId: input.awayTeamId, basis: 'favorite', needsChoice: false };

  if (
    input.pledgeValid &&
    (input.pledgeTeamId === input.homeTeamId || input.pledgeTeamId === input.awayTeamId)
  ) {
    return { teamId: input.pledgeTeamId, basis: 'pledge', needsChoice: false };
  }
  return { teamId: null, basis: null, needsChoice: false };
}
