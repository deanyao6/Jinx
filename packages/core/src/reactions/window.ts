/**
 * The scheduled check-in reaction: exactly one per game, always late, when the result is in
 * the balance (docs/prompts/social/03, section 2a; the NBA row from 00_repo_reality.md R3).
 *
 *   MLB  between the start of the 7th and the end of the 8th.
 *   NFL  in the 4th quarter, before the two-minute warning.
 *   NBA  from the start of the 4th quarter.
 *   MLS  from the 70th minute (the brief's soccer rule).
 *
 * Inside the window the prompt is not fired at a random moment: it waits for the window's
 * middle (the 8th, nine minutes left, eight minutes left, the 80th minute), so it lands as late
 * as the rule allows while the game is still open. A blowout, either side above 92% to win,
 * pushes it to the window's start instead of skipping it, so people still get their one
 * prompt. If nothing has fired by the window's end, the last poll inside it fires anyway.
 */
import type { LiveSnapshot } from './types.js';

export const BLOWOUT_WP = 0.92;

export type ScheduledDecision =
  /** Fire the scheduled prompt now, if it has not fired. */
  | { due: true; reason: 'blowout' | 'window_middle' | 'window_end' }
  /** Inside the window, waiting for its middle. */
  | { due: false; reason: 'waiting' }
  /** Before the window opens. */
  | { due: false; reason: 'not_yet' }
  /** The game is over, or the window has closed with the game still on. */
  | { due: false; reason: 'over' };

interface WindowRule {
  /** The window has opened (and not closed). */
  open(live: LiveSnapshot): boolean;
  /** The window has closed with the game still on. Never true for a window open to the end. */
  closed(live: LiveSnapshot): boolean;
  /** The window's middle has been reached: the normal firing point. */
  middle(live: LiveSnapshot): boolean;
  /** The last chance inside the window. */
  end(live: LiveSnapshot): boolean;
}

const period = (l: LiveSnapshot) => l.period ?? 0;
const clock = (l: LiveSnapshot) => l.clockSeconds;

/** Keyed by sport_id, like every rule in the repo. */
export const SCHEDULED_WINDOWS: Readonly<Record<string, WindowRule>> = {
  mlb: {
    open: (l) => period(l) >= 7 && period(l) < 9,
    closed: (l) => period(l) >= 9,
    middle: (l) => period(l) >= 8,
    end: (l) => period(l) === 8 && l.periodState === 'end',
  },
  nfl: {
    // Overtime never opens it: the window is the 4th quarter before the two-minute warning.
    open: (l) => period(l) === 4 && (clock(l) == null || clock(l)! > 120),
    closed: (l) => period(l) > 4 || (period(l) === 4 && clock(l) != null && clock(l)! <= 120),
    middle: (l) => period(l) === 4 && clock(l) != null && clock(l)! <= 9 * 60 && clock(l)! > 120,
    end: (l) => period(l) === 4 && clock(l) != null && clock(l)! <= 150 && clock(l)! > 120,
  },
  nba: {
    open: (l) => period(l) >= 4,
    closed: () => false,
    middle: (l) => period(l) > 4 || (period(l) === 4 && clock(l) != null && clock(l)! <= 8 * 60),
    end: (l) => period(l) > 4 || (period(l) === 4 && clock(l) != null && clock(l)! <= 2 * 60),
  },
  mls: {
    // `clockSeconds` carries the elapsed minute for soccer. Extra time and a shootout keep it open.
    open: (l) => period(l) >= 3 || (period(l) === 2 && clock(l) != null && clock(l)! >= 70),
    closed: () => false,
    middle: (l) => period(l) >= 3 || (period(l) === 2 && clock(l) != null && clock(l)! >= 80),
    end: (l) => period(l) >= 3 || (period(l) === 2 && clock(l) != null && clock(l)! >= 88),
  },
};

export function isBlowout(homeWp: number | null | undefined): boolean {
  return homeWp != null && (homeWp >= BLOWOUT_WP || homeWp <= 1 - BLOWOUT_WP);
}

/** Whether the one scheduled prompt is due at this poll. The caller remembers that it fired. */
export function scheduledPromptDecision(sport: string, live: LiveSnapshot): ScheduledDecision {
  const rule = SCHEDULED_WINDOWS[sport];
  if (!rule || live.status === 'final') return { due: false, reason: 'over' };
  if (live.status !== 'live' || live.period == null) return { due: false, reason: 'not_yet' };
  if (rule.closed(live)) return { due: false, reason: 'over' };
  if (!rule.open(live)) return { due: false, reason: 'not_yet' };
  if (isBlowout(live.homeWp)) return { due: true, reason: 'blowout' };
  if (rule.end(live)) return { due: true, reason: 'window_end' };
  if (rule.middle(live)) return { due: true, reason: 'window_middle' };
  return { due: false, reason: 'waiting' };
}

/** No prompt of any kind in the first ten minutes of a game (section 2d). */
export const QUIET_START_MS = 10 * 60_000;

/** The capture window: two minutes from the prompt; later posts are allowed and labelled late. */
export const PROMPT_WINDOW_SECONDS = 120;

/** "late by 4 min", or null inside the window (section 4). */
export function lateLabel(lateSeconds: number | null | undefined): string | null {
  if (lateSeconds == null || lateSeconds <= PROMPT_WINDOW_SECONDS) return null;
  const minutes = Math.round(lateSeconds / 60);
  return minutes >= 60 ? `late by ${Math.round(minutes / 60)} h` : `late by ${minutes} min`;
}
