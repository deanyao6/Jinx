import { gameResult, type GameResult } from '@jinx/core';

/**
 * Record rewind (Dean, 2026-09-17): hold the big record on the Passport and it winds back to
 * 0 and 0, then replays the person's history game by game.
 *
 * Pure rules only. The drawing is `RecordRewind.tsx`; the games come from the attendances the
 * record game log already reads, so nothing here fetches anything.
 */

/** An attended game, as far as the replay needs to know it. Sport never matters here. */
export type ReplayGame = {
  gameId: string;
  scheduledStart: string;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId?: string | null;
  /** The side the person was on. Null is a neutral game, which no record counts. */
  rootingTeamId: string | null;
  homeAbbreviation: string | null;
  awayAbbreviation: string | null;
};

export type Tally = { w: number; l: number; t: number };

/** One tick of the replay: the record after this game, and the line that names the game. */
export type ReplayStep = Tally & { label: string };

export type ReplayOptions = {
  /**
   * The team pill in effect. `'all'`, null or undefined replays the lifetime record; a team id
   * replays only the games the person was on that team's side for, which is what that pill's
   * record counts (`teamRecord` in packages/core).
   */
  pill?: string | null;
  /** Histories longer than this are sampled down to it. */
  maxSteps?: number;
  /** "Sep 16, 2025". Injected so tests do not depend on the machine's locale or time zone. */
  formatDate?: (iso: string) => string;
};

/** Above this many games the replay skips some, so it still fits in eight seconds. */
export const MAX_REPLAY_STEPS = 150;

const EN_DASH = String.fromCharCode(0x2013);
const MIDDLE_DOT = String.fromCharCode(0x00b7);
const LETTER: Record<GameResult, string> = { win: 'W', loss: 'L', tie: 'T' };

function defaultFormatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "31 – 17", and "31 – 17 – 2" once there is a tie: the hero's own spacing. */
export function formatTally(tally: Tally): string {
  const base = `${tally.w} ${EN_DASH} ${tally.l}`;
  return tally.t > 0 ? `${base} ${EN_DASH} ${tally.t}` : base;
}

/**
 * The replay, oldest game first.
 *
 * A game with no result for the person is skipped, exactly as the record skips it: a neutral
 * game with no side, a game that is not final, a side that did not play. A tie is a step of
 * its own. An empty history returns no steps and the egg does nothing.
 *
 * Every game is counted even when the list is sampled, so a sampled step shows the true record
 * as of that game, and the last step is always the last game: the replay ends on the record.
 */
export function replaySteps(
  games: readonly ReplayGame[],
  options: ReplayOptions = {},
): ReplayStep[] {
  const { pill, maxSteps = MAX_REPLAY_STEPS, formatDate = defaultFormatDate } = options;
  const team = pill && pill !== 'all' ? pill : null;
  const ordered = [...games].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));

  const steps: ReplayStep[] = [];
  const tally: Tally = { w: 0, l: 0, t: 0 };
  for (const g of ordered) {
    if (team && g.rootingTeamId !== team) continue;
    const result = gameResult(
      {
        gameId: g.gameId,
        status: g.status as 'final',
        scheduledStart: g.scheduledStart,
        homeTeamId: g.homeTeamId,
        awayTeamId: g.awayTeamId,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        winnerTeamId: g.winnerTeamId,
        rootingTeamId: g.rootingTeamId,
        rootingBasis: null,
      },
      g.rootingTeamId,
    );
    if (!result) continue;
    if (result === 'win') tally.w += 1;
    else if (result === 'loss') tally.l += 1;
    else tally.t += 1;
    const matchup = `${g.awayAbbreviation ?? 'Away'} at ${g.homeAbbreviation ?? 'Home'}`;
    const label = [formatDate(g.scheduledStart), matchup, LETTER[result]]
      .filter(Boolean)
      .join(` ${MIDDLE_DOT} `);
    steps.push({ ...tally, label });
  }

  return sample(steps, Math.max(1, Math.floor(maxSteps)));
}

/** Evenly spaced picks that always keep the last one. */
function sample<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max) return [...items];
  const out: T[] = [];
  for (let i = 1; i <= max; i += 1) {
    const index = Math.ceil((i * items.length) / max) - 1;
    out.push(items[index] as T);
  }
  return out;
}

/** How long the forward replay runs. Short histories tick slowly; long ones never pass 8 s. */
export function replayTiming(stepCount: number): { stepMs: number; totalMs: number } {
  if (stepCount <= 0) return { stepMs: 0, totalMs: 0 };
  // Up to ten games, 400 ms each. From there the whole replay stretches from 4 s to 8 s as the
  // history grows to the sampling limit, so each step gets quicker rather than the wait longer.
  const totalMs =
    stepCount <= 10
      ? stepCount * 400
      : 4000 +
        (4000 * (Math.min(stepCount, MAX_REPLAY_STEPS) - 10)) / Math.max(1, MAX_REPLAY_STEPS - 10);
  return { stepMs: totalMs / stepCount, totalMs };
}

/** The odometer winding back: today's record down to zero, in `frames` even turns. */
export function rewindFrames(from: Tally, frames = 12): Tally[] {
  const n = Math.max(1, Math.floor(frames));
  const out: Tally[] = [];
  for (let i = 1; i <= n; i += 1) {
    const keep = 1 - i / n;
    out.push({
      w: Math.round(from.w * keep),
      l: Math.round(from.l * keep),
      t: Math.round(from.t * keep),
    });
  }
  return out;
}

/** Reads "31 – 17" or "6 – 2 – 1" back into numbers. Null when the text is not a record. */
export function parseTally(record: string): Tally | null {
  const parts = record.split(EN_DASH).map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => Number.isNaN(n))) return null;
  return { w: nums[0] as number, l: nums[1] as number, t: nums[2] ?? 0 };
}
