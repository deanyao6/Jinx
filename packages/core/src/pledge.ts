/**
 * Pledge lock rules (SPEC.md 6.3, 6.4, 6.5).
 *  - Estimated lock: what the app counts down to before the game.
 *  - True lock: computed from play-by-play after the game, used to validate pledges.
 */
import type { CanonicalGameDetail, LiveState, MlbPlay, NflPlay, Sport } from './types.js';

export const PLEDGE_GRACE_MS = 60_000;

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Check-in window: 3 hours before start until 1 hour after final (or 6 hours after start when unknown). */
export function checkInWindow(
  scheduledStart: string,
  finalAt: string | null,
): { opensAt: string; closesAt: string } {
  const start = Date.parse(scheduledStart);
  const closes = finalAt ? Date.parse(finalAt) + HOUR : start + 6 * HOUR;
  return {
    opensAt: new Date(start - 3 * HOUR).toISOString(),
    closesAt: new Date(closes).toISOString(),
  };
}

export function isWithinCheckInWindow(
  now: string,
  scheduledStart: string,
  finalAt: string | null,
): boolean {
  const w = checkInWindow(scheduledStart, finalAt);
  const t = Date.parse(now);
  return t >= Date.parse(w.opensAt) && t <= Date.parse(w.closesAt);
}

/** Geofence test: within venue radius plus reported accuracy (accuracy capped at +200 m). */
export function isInsideGeofence(distanceM: number, accuracyM: number, geofenceM: number): boolean {
  return distanceM <= geofenceM + Math.min(Math.max(accuracyM, 0), 200);
}

/** Great-circle distance in meters. */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(a));
}

export interface EstimatedLock {
  /** ISO time the countdown targets. */
  at: string;
  /** True when the lock has already happened according to live data. */
  locked: boolean;
  /** Copy for the UI. */
  reason: 'first_score' | 'end_of_first' | 'ten_minutes_q1' | 'estimate' | 'live_fallback';
}

/**
 * Estimated lock for the countdown. MLB uses live state when available (locks immediately on a run or
 * at the end of the first); otherwise scheduled start + 30 minutes. NFL is scheduled start + 12 minutes.
 */
export function estimatedLock(
  sport: Sport,
  scheduledStart: string,
  live: LiveState | null,
  now: string,
): EstimatedLock {
  const start = Date.parse(scheduledStart);
  if (sport === 'nfl') {
    const at = new Date(start + 12 * MIN).toISOString();
    return { at, locked: Date.parse(now) >= start + 12 * MIN, reason: 'estimate' };
  }
  if (live) {
    if (live.homeScore > 0 || live.awayScore > 0)
      return { at: live.fetchedAt, locked: true, reason: 'first_score' };
    const pastFirst =
      (live.inning ?? 0) > 1 ||
      ((live.inning ?? 0) === 1 && live.inningState === 'end') ||
      live.status === 'final';
    if (pastFirst) return { at: live.fetchedAt, locked: true, reason: 'end_of_first' };
    // Still scoreless in the first: keep the fallback timer as the visible target.
    const at = new Date(Math.max(start + 30 * MIN, Date.parse(live.fetchedAt) + MIN)).toISOString();
    return { at, locked: false, reason: 'live_fallback' };
  }
  const at = new Date(start + 30 * MIN).toISOString();
  return { at, locked: Date.parse(now) >= start + 30 * MIN, reason: 'estimate' };
}

export interface TrueLock {
  /** Null when the timeline lacks usable timestamps. */
  at: string | null;
  reliable: boolean;
  reason: 'first_score' | 'end_of_first' | 'ten_minutes_q1' | 'unknown';
}

function mlbTrueLock(plays: MlbPlay[]): TrueLock {
  let firstRun: string | null = null;
  let firstRunMissing = false;
  let endOfFirst: string | null = null;
  let endOfFirstMissing = false;
  for (const p of plays) {
    if (firstRun === null && (p.homeScore > 0 || p.awayScore > 0)) {
      if (p.endTime) firstRun = p.endTime;
      else firstRunMissing = true;
      break;
    }
  }
  const bottomFirst = plays.filter((p) => p.inning === 1 && p.half === 'bottom');
  const last = bottomFirst[bottomFirst.length - 1];
  if (last) {
    if (last.endTime) endOfFirst = last.endTime;
    else endOfFirstMissing = true;
  }
  const candidates: { at: string; reason: TrueLock['reason'] }[] = [];
  if (firstRun) candidates.push({ at: firstRun, reason: 'first_score' });
  if (endOfFirst) candidates.push({ at: endOfFirst, reason: 'end_of_first' });
  if (candidates.length === 0) return { at: null, reliable: false, reason: 'unknown' };
  candidates.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const best = candidates[0]!;
  // Unreliable if the event that might have come first had no timestamp.
  const reliable = !firstRunMissing && !endOfFirstMissing;
  return { at: best.at, reliable, reason: best.reason };
}

function nflTrueLock(plays: NflPlay[]): TrueLock {
  let firstScore: string | null = null;
  let firstScoreMissing = false;
  let tenMin: string | null = null;
  let tenMinMissing = false;
  for (const p of plays) {
    if (firstScore === null && (p.homeScore > 0 || p.awayScore > 0)) {
      if (p.timeOfDay) firstScore = p.timeOfDay;
      else firstScoreMissing = true;
      break;
    }
  }
  for (const p of plays) {
    if (p.qtr === 1 && p.quarterSecondsRemaining !== null && p.quarterSecondsRemaining <= 600) {
      if (p.timeOfDay) tenMin = p.timeOfDay;
      else tenMinMissing = true;
      break;
    }
    if (p.qtr > 1) break;
  }
  const candidates: { at: string; reason: TrueLock['reason'] }[] = [];
  if (firstScore) candidates.push({ at: firstScore, reason: 'first_score' });
  if (tenMin) candidates.push({ at: tenMin, reason: 'ten_minutes_q1' });
  if (candidates.length === 0) return { at: null, reliable: false, reason: 'unknown' };
  candidates.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const best = candidates[0]!;
  return { at: best.at, reliable: !firstScoreMissing && !tenMinMissing, reason: best.reason };
}

/** Authoritative lock time from play-by-play (SPEC 6.5.1). */
export function trueLock(detail: CanonicalGameDetail): TrueLock {
  return detail.plays.sport === 'mlb'
    ? mlbTrueLock(detail.plays.items)
    : nflTrueLock(detail.plays.items);
}

export type PledgeValidation =
  | { status: 'valid'; reason: 'before_lock' | 'unreliable_timestamps' }
  | { status: 'void'; reason: 'after_lock' };

/** SPEC 6.5.2-3: valid if pledged at or before the lock (+60 s grace); missing data never voids. */
export function validatePledge(
  pledgedAt: string,
  lock: TrueLock,
  graceMs = PLEDGE_GRACE_MS,
): PledgeValidation {
  if (lock.at === null || !lock.reliable)
    return { status: 'valid', reason: 'unreliable_timestamps' };
  return Date.parse(pledgedAt) <= Date.parse(lock.at) + graceMs
    ? { status: 'valid', reason: 'before_lock' }
    : { status: 'void', reason: 'after_lock' };
}

/** Result of a pledge from the final score. */
export function pledgeResult(
  pledgedSide: 'home' | 'away',
  homeScore: number,
  awayScore: number,
): 'win' | 'loss' | 'tie' {
  if (homeScore === awayScore) return 'tie';
  const homeWon = homeScore > awayScore;
  return (pledgedSide === 'home') === homeWon ? 'win' : 'loss';
}
