import { eggs } from './flags';

/**
 * The two easter eggs that live on a stadium stamp (Dean, 2026-09-17).
 *
 * Pure rules only. What a seal looks like is `components/reference/Seal`; which stadium gets
 * which look is `features/passport/seals`.
 */

/** 0 crisp, 1 lightly worn, 2 heavily worn and over-inked. Matches `Seal`'s `wear` prop. */
export type StampWear = 0 | 1 | 2;

/** Visits at which a stamp starts to show its age, and at which it is thoroughly used. */
export const WORN_FROM = 5;
export const HEAVILY_WORN_FROM = 10;

type Flags = { readonly wornStamps: boolean; readonly goldenStamps: boolean };

/** 1 to 4 visits is crisp, 5 to 9 lightly worn, 10 or more heavily worn. */
export function stampWear(visits: number | null | undefined, flags: Flags = eggs): StampWear {
  if (!flags.wornStamps || visits == null || !Number.isFinite(visits)) return 0;
  if (visits >= HEAVILY_WORN_FROM) return 2;
  return visits >= WORN_FROM ? 1 : 0;
}

/** How an attended game went for the side the person was pulling for. Null when they had none. */
export type RootedResult = 'win' | 'loss' | 'tie' | null;

/**
 * One rare moment: a `game_events.type`, and whether it only counts when your side won.
 * "An overtime win" is rare; sitting through an overtime loss is not a golden memory.
 */
export type RareMoment = { type: string; needsWin?: boolean };

/**
 * What turns a stadium's stamp gold, sport by sport, keyed by `sports.id`.
 *
 * The types are `game_events.type` values (`MomentType` in packages/core). A new sport adds a
 * row here and nothing else. A sport with no row has no golden stamps.
 *
 * MLB: a no-hitter, a perfect game, a cycle, any walk-off, an immaculate inning.
 * NFL: an overtime win, a score as time expires, a comeback from 14 down.
 */
export const RARE_MOMENTS: Readonly<Record<string, readonly RareMoment[]>> = {
  mlb: [
    { type: 'no_hitter' },
    { type: 'perfect_game' },
    { type: 'cycle' },
    { type: 'walk_off' },
    { type: 'walk_off_home_run' },
    { type: 'immaculate_inning' },
  ],
  nfl: [{ type: 'overtime', needsWin: true }, { type: 'walk_off_score' }, { type: 'comeback_14' }],
};

/** Every event type any sport counts, for asking the database for just those rows. */
export const RARE_MOMENT_TYPES: readonly string[] = Array.from(
  new Set(Object.values(RARE_MOMENTS).flatMap((rows) => rows.map((row) => row.type))),
).sort();

/** Whether one event at one game is a rare moment for that game's sport. */
export function isRareMoment(sport: string, type: string, result: RootedResult): boolean {
  const row = (RARE_MOMENTS[sport] ?? []).find((r) => r.type === type);
  if (!row) return false;
  return row.needsWin ? result === 'win' : true;
}

/** An attended game, as far as the golden rule needs to know it. */
export type WitnessedGame = {
  sport: string;
  venueId: string | null;
  eventTypes: readonly string[];
  result: RootedResult;
};

/** The stadiums where the person saw something rare. Empty when the egg is switched off. */
export function goldenVenueIds(
  games: readonly WitnessedGame[],
  flags: Flags = eggs,
): ReadonlySet<string> {
  const out = new Set<string>();
  if (!flags.goldenStamps) return out;
  for (const game of games) {
    if (!game.venueId) continue;
    if (game.eventTypes.some((type) => isRareMoment(game.sport, type, game.result))) {
      out.add(game.venueId);
    }
  }
  return out;
}
