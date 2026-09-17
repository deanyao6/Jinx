import { gameResult } from '@jinx/core';

import type { ReplayGame } from './rewind';

/**
 * Curse breaker (Dean, 2026-09-17): a win that ends a personal losing streak of five or more
 * shatters a mirror over the record, once.
 *
 * The stats payload's `streaks` cannot answer this. After the win `current` is +1 and
 * `longest_loss` is the longest ever, which may be a run from years ago. The run that the latest
 * win ended only exists in the per-game results, and those are already loaded for the record
 * game log, so the rule reads them and nothing new is fetched.
 */

/** A losing run has to be at least this long to be a curse. */
export const CURSE_LENGTH = 5;

/** A win older than this is history, not news: nothing shatters for a game from last season. */
export const CURSE_FRESH_DAYS = 30;

export type CurseBroken = {
  /** The win that ended it. What "celebrated once" is remembered by. */
  gameId: string;
  /** How many straight losses came before it. */
  losses: number;
};

export type CurseOptions = {
  /** Now, in ms. Defaults to the clock; tests pass their own. */
  now?: number;
  minLosses?: number;
  freshDays?: number;
};

/**
 * The curse the person's latest decision broke, or null.
 *
 * Read oldest to newest, over the lifetime record (every game with a side, all teams):
 *   - Neutral games, games that are not final and sides that did not play have no result and
 *     are ignored, as every record ignores them.
 *   - **A tie neither extends nor breaks a losing run.** Five losses, a tie, then a win is a
 *     curse of five, broken. A tie is not the win the person was waiting for, so the wait goes
 *     on through it; and it is not a loss, so it does not make the run longer. This differs on
 *     purpose from `streaks()` in packages/core, where a tie resets the current streak: that
 *     function answers "how long is the streak on the hero", this one "how long since a win".
 *   - Only the latest decision counts. L x5, W triggers; L x5, W, W does not, because the newest
 *     win ended a run of zero. L x5, W, L does not either: the streak is no longer a win.
 */
export function curseBroken(
  games: readonly ReplayGame[],
  options: CurseOptions = {},
): CurseBroken | null {
  const { now = Date.now(), minLosses = CURSE_LENGTH, freshDays = CURSE_FRESH_DAYS } = options;
  const ordered = [...games].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));

  let run = 0;
  let latest: { gameId: string; scheduledStart: string; endedRun: number } | null = null;
  for (const g of ordered) {
    const result = gameResult(
      {
        gameId: g.gameId,
        status: g.status as 'final',
        scheduledStart: g.scheduledStart,
        homeTeamId: g.homeTeamId,
        awayTeamId: g.awayTeamId,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        rootingTeamId: g.rootingTeamId,
        rootingBasis: null,
      },
      g.rootingTeamId,
    );
    if (result === null || result === 'tie') continue;
    if (result === 'loss') {
      run += 1;
      latest = null;
    } else {
      latest = { gameId: g.gameId, scheduledStart: g.scheduledStart, endedRun: run };
      run = 0;
    }
  }

  if (!latest || latest.endedRun < minLosses) return null;
  const age = now - Date.parse(latest.scheduledStart);
  if (!Number.isFinite(age) || age > freshDays * 24 * 60 * 60 * 1000) return null;
  return { gameId: latest.gameId, losses: latest.endedRun };
}

/** The line under the shards. */
export function curseLine(losses: number): string {
  return `Curse broken. ${losses} straight losses, over.`;
}
