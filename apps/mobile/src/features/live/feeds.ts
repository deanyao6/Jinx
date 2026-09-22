/**
 * Live feeds the app reads itself (Dean, decision 8, 2026-09-22): free public feeds that answer
 * plain HTTPS from a phone and need no key. Supabase's egress cannot reach any NBA host or
 * ESPN, which is why NBA live state never existed server-side (docs/verification.md); the phone
 * can. MLB keeps its server-side path (`game_live_state`, written by `mlb-live`) because it
 * works. The MLB Stats API and the Anthropic API are still never called from the client.
 *
 * One row per sport, keyed by `sport_id`, behind the shape the MLB path already returns to the
 * app (`LiveState` in features/checkin/lock.ts), so Pick a side, the check-in window, the
 * scoreboard and the eggs read either the same way. A feed never writes to the database: the
 * server stays the source of truth for the final score.
 *
 * Polled only while a fan is checked in or on a game page with a game under way, every
 * `pollMs`, backing off on errors (features/checkin/queries.ts, `useLiveState`).
 */
import { parseCdnLiveState, parseMlsLiveState, type CdnScoreboardGame } from '@jinx/core';

import type { LiveState } from '@/features/checkin/lock';

/** What a feed needs to know about the game: the provider's id and when it starts. */
export type LiveGame = {
  provider_game_id?: string | null;
  scheduled_start: string;
};

export type LiveFeed = {
  sport: string;
  /** How often to ask while a game is under way. */
  pollMs: number;
  /**
   * The game's live state, or null when the feed does not carry it (the game is not on today's
   * board yet), which leaves the countdown on its estimate. Throws on a network failure, which
   * the poller backs off from.
   */
  fetchLive(game: LiveGame, now?: string): Promise<LiveState | null>;
};

// The header set nba.com's own pages send; nothing is impersonated (docs/verification.md).
// React Native sets its own User-Agent; the CDN answered these from a device build on
// 2026-09-22 (the probe on the Easter eggs page).
const NBA_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.nba.com/',
  Origin: 'https://www.nba.com',
};

export const NBA_SCOREBOARD_URL =
  'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json';
export const MLS_SUMMARY_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/summary';

async function getJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers: headers ?? { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return (await res.json()) as T;
}

/** A core `LiveState` as the app's row: the column names of `game_live_state`. */
export function toRow(
  live: {
    status: string;
    inning: number | null;
    inningState: string | null;
    clock?: string | null;
    homeScore: number;
    awayScore: number;
    fetchedAt: string;
  },
): LiveState {
  return {
    status: live.status,
    inning: live.inning,
    inning_state: live.inningState,
    clock: live.clock ?? null,
    home_score: live.homeScore,
    away_score: live.awayScore,
    // The lock is decided by estimateLock from the state itself; the server's precomputed
    // flag belongs to the MLB path only.
    locked: false,
    lock_reason: null,
    fetched_at: live.fetchedAt,
  };
}

type CdnScoreboard = { scoreboard?: { gameDate?: string; games?: CdnScoreboardGame[] } };

/** The NBA CDN's live scoreboard: every game of the day in one document. */
export const nbaLiveFeed: LiveFeed = {
  sport: 'nba',
  pollMs: 30_000,
  async fetchLive(game, now = new Date().toISOString()) {
    if (!game.provider_game_id) return null;
    const doc = await getJson<CdnScoreboard>(NBA_SCOREBOARD_URL, NBA_HEADERS);
    const g = doc.scoreboard?.games?.find((x) => x.gameId === game.provider_game_id);
    return g ? toRow(parseCdnLiveState(g, now)) : null;
  },
};

type MlsSummaryDoc = Parameters<typeof parseMlsLiveState>[0];

/** ESPN's match summary header: status, clock and score for one match. */
export const mlsLiveFeed: LiveFeed = {
  sport: 'mls',
  pollMs: 30_000,
  async fetchLive(game, now = new Date().toISOString()) {
    if (!game.provider_game_id) return null;
    const doc = await getJson<MlsSummaryDoc>(
      `${MLS_SUMMARY_URL}?event=${encodeURIComponent(game.provider_game_id)}`,
    );
    const live = parseMlsLiveState(doc, now);
    return live ? toRow(live) : null;
  },
};

/** The feeds the app reads itself. A sport not here reads `game_live_state` (MLB) or nothing (NFL). */
export const CLIENT_LIVE_FEEDS: Readonly<Record<string, LiveFeed>> = {
  nba: nbaLiveFeed,
  mls: mlsLiveFeed,
};

export function clientLiveFeed(sport: string | null | undefined): LiveFeed | undefined {
  return sport ? CLIENT_LIVE_FEEDS[sport] : undefined;
}

/** Backoff for a failing poll: 30 s, 1 min, 2 min, 4 min, then 5 min at most. */
export function pollDelayMs(base: number, failures: number): number {
  return Math.min(base * 2 ** Math.min(failures, 8), 5 * 60_000);
}
