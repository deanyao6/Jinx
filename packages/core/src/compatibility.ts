/**
 * Compatibility between two mutual follows (social brief 02, section 6): one number from 0 to
 * 100 and the one thing that drives it most.
 *
 * Four parts, each worth 0 to 1:
 *   teams:  favorite teams in common, as a share of all the favorite teams either has (Jaccard).
 *   venues: venues both have been to, against the smaller of the two collections, damped by 2
 *           so two fans with one stadium each and that one in common do not score a perfect 1.
 *   games:  games both attended, saturating: 1 game is 0.28, 3 are 0.63, 6 are 0.86.
 *   picks:  how alike they pick sides at neutral games, 1 minus the gap between their underdog
 *           rates. Only when both have at least three neutral picks; otherwise it is left out
 *           and the other weights share its place.
 *
 * `compatibility_score()` in supabase/migrations/20260924010300_compatibility.sql is the SQL twin
 * of this function; pgTAP 074 checks it against the same examples as compatibility.test.ts.
 */

export type CompatibilityInput = {
  teamsA: number;
  teamsB: number;
  sharedTeams: number;
  venuesA: number;
  venuesB: number;
  sharedVenues: number;
  sharedGames: number;
  /** Share of neutral picks that were the underdog, or null with fewer than three picks. */
  underdogRateA: number | null;
  underdogRateB: number | null;
};

export type CompatibilityDriver = 'teams' | 'venues' | 'games' | 'picks' | 'none';

export type Compatibility = {
  score: number;
  driver: CompatibilityDriver;
  /** The count the driver sentence quotes: teams, venues or games in common. */
  driverCount: number;
};

export const COMPATIBILITY_WEIGHTS = { teams: 30, venues: 30, games: 25, picks: 15 } as const;

export const MIN_NEUTRAL_PICKS = 3;

export function compatibility(input: CompatibilityInput): Compatibility {
  const teamsUnion = input.teamsA + input.teamsB - input.sharedTeams;
  const parts: Record<Exclude<CompatibilityDriver, 'none'>, number | null> = {
    teams: teamsUnion > 0 ? input.sharedTeams / teamsUnion : 0,
    venues:
      Math.min(input.venuesA, input.venuesB) > 0
        ? input.sharedVenues / (Math.min(input.venuesA, input.venuesB) + 2)
        : 0,
    games: 1 - Math.exp(-input.sharedGames / 3),
    picks:
      input.underdogRateA === null || input.underdogRateB === null
        ? null
        : 1 - Math.abs(input.underdogRateA - input.underdogRateB),
  };

  let total = 0;
  let weights = 0;
  let driver: CompatibilityDriver = 'none';
  let best = 0;
  for (const key of ['teams', 'venues', 'games', 'picks'] as const) {
    const value = parts[key];
    if (value === null) continue;
    const weighted = COMPATIBILITY_WEIGHTS[key] * value;
    total += weighted;
    weights += COMPATIBILITY_WEIGHTS[key];
    // Ties go to the earlier part in the list: a shared team explains more than a shared game.
    if (weighted > best + 1e-9) {
      best = weighted;
      driver = key;
    }
  }
  const score = weights > 0 ? Math.round((100 * total) / weights) : 0;
  const driverCount =
    driver === 'teams'
      ? input.sharedTeams
      : driver === 'venues'
        ? input.sharedVenues
        : driver === 'games'
          ? input.sharedGames
          : 0;
  return { score, driver, driverCount };
}

/** The one line under the number: "You have 6 stadiums in common." */
export function compatibilitySentence(driver: CompatibilityDriver, count: number): string {
  switch (driver) {
    case 'teams':
      return count === 1 ? 'You share a favorite team.' : `You share ${count} favorite teams.`;
    case 'venues':
      return count === 1 ? 'You have 1 stadium in common.' : `You have ${count} stadiums in common.`;
    case 'games':
      return count === 1 ? 'You were at 1 game together.' : `You were at ${count} of the same games.`;
    case 'picks':
      return 'You pick sides the same way at neutral games.';
    case 'none':
      return 'You have not crossed paths yet.';
  }
}
