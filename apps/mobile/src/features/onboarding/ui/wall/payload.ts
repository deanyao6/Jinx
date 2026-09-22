import AsyncStorage from '@react-native-async-storage/async-storage';

import { env } from '@/lib/env';

import { parseWelcomeWall, type WelcomeWallPayload } from './types';

/**
 * The weekly payload's life on the device (SPEC.md 8.8).
 *
 * - On the welcome screen's mount the cache is read. A valid payload no older than
 *   {@link MAX_AGE_MS} draws; anything else means the bundled set.
 * - Then, at most once every {@link REFRESH_EVERY_MS}, `GET /welcome-wall` runs in the
 *   background and writes the cache. It never updates the screen that is showing: a wall that
 *   re-stocks itself under someone's thumb is a glitch, so the new cards wait for the next
 *   launch.
 * - Nothing here can throw at the caller and nothing blocks. Sign-in needs none of it.
 */

export const CACHE_KEY = 'welcome-wall.v1';
export const REFRESH_EVERY_MS = 6 * 60 * 60 * 1000;
export const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

type Cached = { fetchedAt: string; payload: unknown };

export function wallUrl(): string {
  return `${env.supabaseUrl.replace(/\/$/, '')}/functions/v1/welcome-wall`;
}

/**
 * The cached payload if it is valid and fresh, else null. Freshness is the job's own
 * `updated_at`, not when the app fetched it: a two-week-old wall is stale wherever it came from.
 */
export function usableCache(raw: string | null, now: Date): WelcomeWallPayload | null {
  if (!raw) return null;
  let cached: Cached;
  try {
    cached = JSON.parse(raw) as Cached;
  } catch {
    return null;
  }
  const payload = parseWelcomeWall(cached?.payload);
  if (!payload) return null;
  if (now.getTime() - Date.parse(payload.updatedAt) > MAX_AGE_MS) return null;
  return payload;
}

export async function readWallCache(now: Date = new Date()): Promise<WelcomeWallPayload | null> {
  try {
    return usableCache(await AsyncStorage.getItem(CACHE_KEY), now);
  } catch {
    return null;
  }
}

/** Was the last fetch within the throttle window? Reads the cache's own `fetchedAt`. */
export function fetchedRecently(raw: string | null, now: Date): boolean {
  if (!raw) return false;
  try {
    const at = Date.parse((JSON.parse(raw) as Cached).fetchedAt);
    return Number.isFinite(at) && now.getTime() - at < REFRESH_EVERY_MS;
  } catch {
    return false;
  }
}

/**
 * Fetch the current week and cache it, if the last fetch was more than six hours ago. Resolves
 * to what happened, for tests and logs; the screen ignores it.
 */
export async function refreshWallCache(
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<'skipped' | 'cached' | 'rejected' | 'failed'> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (fetchedRecently(raw, now)) return 'skipped';
    const res = await fetchImpl(wallUrl(), { headers: { accept: 'application/json' } });
    if (!res.ok) return 'failed';
    const payload = parseWelcomeWall(await res.json());
    if (!payload) return 'rejected';
    const cached: Cached = { fetchedAt: now.toISOString(), payload: rawOf(payload) };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    return 'cached';
  } catch {
    return 'failed';
  }
}

/** The payload back in the wire shape, so the cache holds exactly what parse accepts. */
function rawOf(p: WelcomeWallPayload): unknown {
  return {
    week_start: p.weekStart,
    updated_at: p.updatedAt,
    cards: p.cards.map((c) => ({
      game_id: c.gameId,
      sport: c.sport,
      title: c.title,
      venue: c.venue,
      played_on: c.playedOn,
      night: c.night,
      date_label: c.dateLabel,
      result: c.result,
      team_key: c.teamKey,
    })),
  };
}
