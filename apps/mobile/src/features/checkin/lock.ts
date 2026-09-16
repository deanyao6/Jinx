/**
 * Pledge lock rules for the countdown (SPEC.md 6.3, 6.4). Mirrors packages/core/src/pledge.ts;
 * a local copy because Metro does not resolve the workspace package's `.js` source imports.
 */
export type Sport = 'mlb' | 'nfl' | string;

export type LiveState = {
  status: string;
  inning: number | null;
  inning_state: string | null;
  home_score: number;
  away_score: number;
  locked: boolean;
  lock_reason: string | null;
  fetched_at: string;
};

const MIN = 60_000;
const HOUR = 60 * MIN;

export type LockEstimate = {
  /** ISO time the countdown targets. */
  at: string;
  /** True once the pick buttons should disable. */
  locked: boolean;
  reason: 'first_score' | 'end_of_first' | 'estimate' | 'live_fallback' | 'live_locked';
};

/** Great-circle distance in meters (haversine). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(a));
}

/** Check-in window: 3 hours before start until 1 hour after final (6 hours after start when unknown). */
export function checkInWindow(
  scheduledStart: string,
  finalAt: string | null,
): { opensAt: number; closesAt: number } {
  const start = Date.parse(scheduledStart);
  const closesAt = finalAt ? Date.parse(finalAt) + HOUR : start + 6 * HOUR;
  return { opensAt: start - 3 * HOUR, closesAt };
}

export function isWithinCheckInWindow(
  now: number,
  scheduledStart: string,
  finalAt: string | null,
): boolean {
  const w = checkInWindow(scheduledStart, finalAt);
  return now >= w.opensAt && now <= w.closesAt;
}

/**
 * Estimated lock for the countdown. MLB uses live state when available (locks on a run or at the end
 * of the first); otherwise scheduled start + 30 minutes. NFL is scheduled start + 12 minutes.
 */
export function estimateLock(
  sport: Sport,
  scheduledStart: string,
  live: LiveState | null,
  nowMs: number,
  serverEstimate?: string | null,
): LockEstimate {
  const start = Date.parse(scheduledStart);
  const fallbackAt =
    serverEstimate ?? new Date(start + (sport === 'nfl' ? 12 : 30) * MIN).toISOString();
  if (sport === 'nfl' || !live) {
    return { at: fallbackAt, locked: nowMs >= Date.parse(fallbackAt), reason: 'estimate' };
  }
  if (live.locked) return { at: live.fetched_at, locked: true, reason: 'live_locked' };
  if (live.home_score > 0 || live.away_score > 0) {
    return { at: live.fetched_at, locked: true, reason: 'first_score' };
  }
  const inning = live.inning ?? 0;
  const pastFirst =
    inning > 1 || (inning === 1 && live.inning_state === 'end') || live.status === 'final';
  if (pastFirst) return { at: live.fetched_at, locked: true, reason: 'end_of_first' };
  // Scoreless in the first: the fallback timer stays the visible target, but never before the next poll.
  const at = new Date(Math.max(Date.parse(fallbackAt), Date.parse(live.fetched_at) + MIN));
  return { at: at.toISOString(), locked: nowMs >= at.getTime(), reason: 'live_fallback' };
}

/** "4:12" style countdown, "Locked" at or past the target. */
export function formatCountdown(targetIso: string, nowMs: number): string {
  const remaining = Math.floor((Date.parse(targetIso) - nowMs) / 1000);
  if (!Number.isFinite(remaining) || remaining <= 0) return 'Locked';
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Plain-language lock rule for the sport. */
export function lockRuleCopy(sport: Sport): string {
  return sport === 'nfl'
    ? 'Locks at the first score or 10:00 left in Q1 (estimated)'
    : 'Locks at the end of the 1st or the first run';
}

/** Short note under the clock. */
export function lockNoteCopy(sport: Sport): string {
  return sport === 'nfl' ? 'or the moment anyone scores' : 'or the moment anyone scores a run';
}

export function pctLabel(prob: number | null | undefined): string {
  if (prob == null || !Number.isFinite(prob)) return '–';
  return `${Math.round(prob * 100)}%`;
}

/** Underdog is the side with the lower win probability; null when unknown or even. */
export function underdogTeamId(
  home: { team_id: string; win_prob: number | null },
  away: { team_id: string; win_prob: number | null },
): string | null {
  if (home.win_prob == null || away.win_prob == null) return null;
  if (home.win_prob === away.win_prob) return null;
  return home.win_prob < away.win_prob ? home.team_id : away.team_id;
}

/** Confirmation copy shown after a pick. */
export function pledgeConfirmationCopy(teamName: string, prob: number | null): string {
  const p = prob ?? 0.5;
  const gain = (1 - p).toFixed(2);
  return `Pledged to the ${teamName} (${pctLabel(p)} to win). You can switch until it locks. A win here adds +${gain} to your record vs expected.`;
}

/** Plain copy for a failed check-in. */
export function checkInFailureCopy(
  reason: string,
  detail: { distance_m?: number; geofence_m?: number; venueName?: string | null },
): string {
  switch (reason) {
    case 'too_far': {
      const d = detail.distance_m != null ? formatDistance(detail.distance_m) : null;
      return d
        ? `You're about ${d} from ${detail.venueName ?? 'the venue'}. Check in once you're inside.`
        : `You're not close enough to ${detail.venueName ?? 'the venue'} yet.`;
    }
    case 'outside_window':
      return 'Check-in opens 3 hours before first pitch or kickoff and closes an hour after the final.';
    case 'not_playing':
      return 'This game was postponed or cancelled, so there is nothing to check in to.';
    case 'venue_unknown':
      return "We don't have a location for this venue yet, so check-in is not available.";
    case 'permission_denied':
      return 'Location access is off. Allow it in Settings to check in.';
    case 'location_unavailable':
      return "We couldn't get your location. Try again in a moment.";
    default:
      return 'Check-in did not go through. Try again.';
  }
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const miles = meters / 1609.344;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

/** Calendar date (YYYY-MM-DD) of an instant in the venue's time zone, falling back to the device zone. */
export function localDateAt(iso: string, tz: string | null | undefined, nowMs?: number): string {
  const d = new Date(nowMs ?? Date.parse(iso));
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz ?? undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }
}

/** True when the game's scheduled start falls on today's date at the venue. */
export function isTodayAtVenue(
  scheduledStart: string,
  tz: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  return localDateAt(scheduledStart, tz) === localDateAt(scheduledStart, tz, nowMs);
}
