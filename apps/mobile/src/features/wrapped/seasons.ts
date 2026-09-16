/** Season bookkeeping for Wrapped. Pure, so the screen logic is unit testable. */

export type WrappedSeason = { sport_id: string; season: number; generated_at: string | null };

/** The NFL season that is in progress or most recently finished (Jan and Feb belong to last year). */
export function currentSeasonFor(sport: string, now = new Date()): number {
  const year = now.getFullYear();
  if (sport === 'nfl' && now.getMonth() < 2) return year - 1;
  return year;
}

/** A Wrapped is a preview until the season is over and the publish job has run. */
export function isPreviewSeason(sport: string, season: number, now = new Date()): boolean {
  return season >= currentSeasonFor(sport, now);
}

/** Seasons with a snapshot plus the in-progress season for each sport, newest first. */
export function seasonOptions(snapshots: WrappedSeason[], now = new Date()): WrappedSeason[] {
  const out = new Map<string, WrappedSeason>();
  for (const sport of ['mlb', 'nfl']) {
    const season = currentSeasonFor(sport, now);
    out.set(`${sport}-${season}`, { sport_id: sport, season, generated_at: null });
  }
  for (const s of snapshots) out.set(`${s.sport_id}-${s.season}`, s);
  return [...out.values()].sort(
    (a, b) => b.season - a.season || a.sport_id.localeCompare(b.sport_id),
  );
}
