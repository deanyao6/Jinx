import type { LiveState } from '@/features/checkin/lock';

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

function ordinal(n: number): string {
  if (n < ORDINAL.length) return ORDINAL[n]!;
  const rem = n % 100;
  if (rem >= 11 && rem <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * The status line of a game under way, in the sport's own words: "Top 7th", "Q3 4:12",
 * "Halftime", "67'", "End of 1st". Null when there is nothing live to say (a scheduled game,
 * or a feed with no period yet), so the caller keeps its date line.
 */
export function liveStatusLabel(sport: string, live: LiveState | null | undefined): string | null {
  if (!live || live.status !== 'live' || live.inning == null) return null;
  const period = live.inning;
  const state = live.inning_state;
  if (state === 'halftime') return 'Halftime';
  if (sport === 'mlb') {
    const half =
      state === 'top' ? 'Top' : state === 'bottom' ? 'Bottom' : state === 'middle' ? 'Middle' : 'End';
    return `${half} ${ordinal(period)}`;
  }
  if (sport === 'mls') {
    if (period >= 5) return 'Penalties';
    const half = period > 2 ? `ET ${period - 2}` : null;
    return live.clock ? (half ? `${half} ${live.clock}` : live.clock) : `${ordinal(period)} half`;
  }
  // Quarters: the NBA and, one day, the NFL.
  const name = period <= 4 ? `Q${period}` : period === 5 ? 'OT' : `${period - 4}OT`;
  if (state === 'end') return `End of ${period <= 4 ? ordinal(period) : name}`;
  return live.clock ? `${name} ${live.clock}` : name;
}

/** Whether a page should poll for live state: the game is live, or near its start. */
export function isUnderWay(
  status: string,
  scheduledStart: string,
  nowMs: number,
  leadMs = 15 * 60_000,
  tailMs = 6 * 60 * 60_000,
): boolean {
  if (status === 'live') return true;
  if (status !== 'scheduled') return false;
  const start = Date.parse(scheduledStart);
  return nowMs >= start - leadMs && nowMs <= start + tailMs;
}
