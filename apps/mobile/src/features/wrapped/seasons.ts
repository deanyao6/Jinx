/** Season bookkeeping for Wrapped. Pure, so the screen logic is unit testable. */

export type WrappedSeason = { sport_id: string; season: number; generated_at: string | null };

/**
 * The season that is in progress or most recently finished, as its START year. The NFL runs
 * into February, so January and February belong to last year; the NBA runs October to June,
 * so anything before August does. `games.season` follows the same rule.
 */
export function currentSeasonFor(sport: string, now = new Date()): number {
  const year = now.getFullYear();
  if (sport === 'nfl' && now.getMonth() < 2) return year - 1;
  if (sport === 'nba' && now.getMonth() < 7) return year - 1;
  return year;
}

/** Every sport Wrapped is built for. */
export const WRAPPED_SPORTS = ['mlb', 'nfl', 'nba'] as const;

/** A Wrapped is a preview until the season is over and the publish job has run. */
export function isPreviewSeason(sport: string, season: number, now = new Date()): boolean {
  return season >= currentSeasonFor(sport, now);
}

/** Seasons with a snapshot plus the in-progress season for each sport, newest first. */
export function seasonOptions(snapshots: WrappedSeason[], now = new Date()): WrappedSeason[] {
  const out = new Map<string, WrappedSeason>();
  for (const sport of WRAPPED_SPORTS) {
    const season = currentSeasonFor(sport, now);
    out.set(`${sport}-${season}`, { sport_id: sport, season, generated_at: null });
  }
  for (const s of snapshots) out.set(`${s.sport_id}-${s.season}`, s);
  return [...out.values()].sort(
    (a, b) => b.season - a.season || a.sport_id.localeCompare(b.sport_id),
  );
}
