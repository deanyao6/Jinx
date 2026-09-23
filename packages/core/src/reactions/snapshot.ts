/**
 * From the app's live row (`game_live_state` columns, which the phone-side feeds also produce)
 * to the sport-neutral snapshot the rules read.
 */
import type { LiveSnapshot } from './types.js';

export interface LiveRow {
  status: string;
  inning: number | null;
  inning_state: string | null;
  clock?: string | null;
  home_score: number;
  away_score: number;
  fetched_at: string;
}

/** "4:12" to 252, "0:03.4" to 3, "67'" to 67 (the elapsed minute), "90'+4'" to 94. */
export function parseClock(sport: string, clock: string | null | undefined): number | null {
  if (!clock) return null;
  if (sport === 'mls') {
    const m = /^(\d+)'(?:\s*\+\s*(\d+)')?/.exec(clock.trim());
    return m ? Number(m[1]) + Number(m[2] ?? 0) : null;
  }
  const m = /^(\d+):(\d+)/.exec(clock.trim());
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const s = /^(\d+(?:\.\d+)?)$/.exec(clock.trim());
  return s ? Math.floor(Number(s[1])) : null;
}

export function toSnapshot(sport: string, row: LiveRow, homeWp: number | null = null): LiveSnapshot {
  return {
    status: row.status,
    period: row.inning,
    periodState: row.inning_state ? row.inning_state.toLowerCase() : null,
    clockSeconds: parseClock(sport, row.clock),
    homeScore: row.home_score,
    awayScore: row.away_score,
    homeWp,
    fetchedAt: row.fetched_at,
  };
}
