/**
 * Rooting side at log time (SPEC.md 6.1, favorites only).
 * Pledges arrive in M5; until then a game with no favorite on either side is neutral.
 * Favorites match by franchise so a relocated or renamed team still counts.
 */
export type TeamRef = { id: string; franchise_id: string };

export type RootingBasis = 'favorite' | 'chosen';

export type RootingDecision = {
  teamId: string | null;
  basis: RootingBasis | null;
  /** The user follows both teams and has not picked a side yet. */
  needsChoice: boolean;
  /** Both teams are favorites (drives the side picker UI). */
  bothFavorites: boolean;
};

export type RootingInput = {
  home: TeamRef;
  away: TeamRef;
  favorites: readonly TeamRef[];
  /** Side the user tapped in the "You follow both" picker. */
  chosenTeamId?: string | null;
};

export function isFavorite(team: TeamRef, favorites: readonly TeamRef[]): boolean {
  return favorites.some((f) => f.franchise_id === team.franchise_id);
}

export function resolveRooting(input: RootingInput): RootingDecision {
  const homeFav = isFavorite(input.home, input.favorites);
  const awayFav = isFavorite(input.away, input.favorites);

  if (homeFav && awayFav) {
    const chosen = input.chosenTeamId;
    if (chosen === input.home.id || chosen === input.away.id) {
      return { teamId: chosen, basis: 'chosen', needsChoice: false, bothFavorites: true };
    }
    return { teamId: null, basis: null, needsChoice: true, bothFavorites: true };
  }
  if (homeFav) {
    return { teamId: input.home.id, basis: 'favorite', needsChoice: false, bothFavorites: false };
  }
  if (awayFav) {
    return { teamId: input.away.id, basis: 'favorite', needsChoice: false, bothFavorites: false };
  }
  return { teamId: null, basis: null, needsChoice: false, bothFavorites: false };
}

/** "going" for games that have not started yet, otherwise "attended". */
export function attendanceStatusFor(
  game: { status: string; scheduled_start: string },
  now: Date = new Date(),
): 'going' | 'attended' {
  if (game.status === 'final') return 'attended';
  const start = new Date(game.scheduled_start);
  return start.getTime() > now.getTime() ? 'going' : 'attended';
}
