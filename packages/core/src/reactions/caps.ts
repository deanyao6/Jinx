/**
 * Caps and spacing (docs/prompts/social/03, section 2d), as pure rules. The database enforces
 * them in `fire_reaction_prompt` (migration 20260924020100); this copy is what the app uses to
 * say "1 of 3 used, one held back" and what the tests pin the rule to.
 *
 *   Three prompts a game at most: one scheduled plus up to two events. The scheduled slot is
 *   reserved: two early events never cost the late-game moment. Twelve minutes between prompts.
 *   An event inside the scheduled window, before the scheduled prompt fired, merges into it.
 *   Two ignored prompts in a row silence the rest for that game. Nothing in the first ten
 *   minutes or after the session ends. Self-triggered reactions do not count, up to five.
 */

export const MAX_EVENT_PROMPTS = 2;
export const MAX_PROMPTS_PER_GAME = 3;
export const MIN_PROMPT_GAP_MS = 12 * 60_000;
export const SILENCE_AFTER_IGNORED = 2;
export const MAX_SELF_TRIGGERS = 5;

export interface PromptSummary {
  kind: 'checkin' | 'event';
  firedAt: string;
}

export interface Slots {
  /** Prompts fired so far, of the three. */
  used: number;
  eventsUsed: number;
  scheduledFired: boolean;
  /** One is always held back for late in the game until it fires. */
  heldBack: boolean;
}

export function promptSlots(prompts: readonly PromptSummary[]): Slots {
  const scheduledFired = prompts.some((p) => p.kind === 'checkin');
  const eventsUsed = Math.min(MAX_EVENT_PROMPTS, prompts.filter((p) => p.kind === 'event').length);
  return {
    used: eventsUsed + (scheduledFired ? 1 : 0),
    eventsUsed,
    scheduledFired,
    heldBack: !scheduledFired,
  };
}

/** "1 of 3 used. One is held back for late in the game." */
export function slotsCopy(slots: Slots): string {
  const head = `${slots.used} of ${MAX_PROMPTS_PER_GAME} used.`;
  if (slots.used >= MAX_PROMPTS_PER_GAME) return `${head} That is every prompt for this game.`;
  return slots.heldBack ? `${head} One is held back for late in the game.` : head;
}

export interface DeliverySummary {
  firedAt: string;
  /** Opened the camera, or posted. */
  answered: boolean;
  windowSeconds: number;
}

export type GameSlotDecision =
  | { ok: true; merge: boolean }
  | { ok: false; reason: 'event_cap' | 'scheduled_fired' | 'quiet_start' | 'game_over' };

/**
 * Whether the game has room for one more prompt of this kind, before anyone in particular is
 * considered. `inScheduledWindow` says the game is inside the late window right now: an event
 * then becomes the scheduled prompt (merge) if that one has not fired.
 */
export function gameSlot(input: {
  kind: 'checkin' | 'event';
  prompts: readonly PromptSummary[];
  startedAt: string;
  now: string;
  gameOver: boolean;
  inScheduledWindow: boolean;
}): GameSlotDecision {
  const { kind, prompts, gameOver, inScheduledWindow } = input;
  if (gameOver) return { ok: false, reason: 'game_over' };
  if (Date.parse(input.now) - Date.parse(input.startedAt) < 10 * 60_000) {
    return { ok: false, reason: 'quiet_start' };
  }
  const slots = promptSlots(prompts);
  if (kind === 'checkin') {
    return slots.scheduledFired ? { ok: false, reason: 'scheduled_fired' } : { ok: true, merge: false };
  }
  if (inScheduledWindow && !slots.scheduledFired) return { ok: true, merge: true };
  return slots.eventsUsed >= MAX_EVENT_PROMPTS ? { ok: false, reason: 'event_cap' } : { ok: true, merge: false };
}

export type RecipientDecision =
  | { ok: true }
  | {
      ok: false;
      reason: 'too_soon' | 'silenced' | 'no_side' | 'wrong_side' | 'muted' | 'off' | 'session_ended';
    };

/**
 * Whether one checked-in fan gets this prompt. Audience `all` reaches everyone; a side reaches
 * the fans rooting for it (a favorite, or a locked neutral pick). Fans with no side get
 * nothing but `all`.
 */
export function recipientDecision(input: {
  audience: 'home' | 'away' | 'all';
  rootingSide: 'home' | 'away' | null;
  deliveries: readonly DeliverySummary[];
  now: string;
  promptsOff: boolean;
  mutedTonight: boolean;
  sessionOpen: boolean;
}): RecipientDecision {
  if (!input.sessionOpen) return { ok: false, reason: 'session_ended' };
  if (input.promptsOff) return { ok: false, reason: 'off' };
  if (input.mutedTonight) return { ok: false, reason: 'muted' };
  if (input.audience !== 'all') {
    if (!input.rootingSide) return { ok: false, reason: 'no_side' };
    if (input.rootingSide !== input.audience) return { ok: false, reason: 'wrong_side' };
  }
  const sorted = [...input.deliveries].sort((a, b) => a.firedAt.localeCompare(b.firedAt));
  const last = sorted[sorted.length - 1];
  if (last && Date.parse(input.now) - Date.parse(last.firedAt) < MIN_PROMPT_GAP_MS) {
    return { ok: false, reason: 'too_soon' };
  }
  const nowMs = Date.parse(input.now);
  const ignored = (d: DeliverySummary) =>
    !d.answered && nowMs - Date.parse(d.firedAt) > d.windowSeconds * 1000;
  const recent = sorted.slice(-SILENCE_AFTER_IGNORED);
  if (recent.length === SILENCE_AFTER_IGNORED && recent.every(ignored)) {
    return { ok: false, reason: 'silenced' };
  }
  return { ok: true };
}

/** Three or more self-triggered reactions at one game within 90 seconds is a crowd moment. */
export const CROWD_MIN_FANS = 3;
export const CROWD_WINDOW_MS = 90_000;

export function crowdSignal(selfTriggers: readonly { userId: string; at: string }[], now: string): boolean {
  const nowMs = Date.parse(now);
  const fans = new Set(
    selfTriggers.filter((t) => nowMs - Date.parse(t.at) <= CROWD_WINDOW_MS).map((t) => t.userId),
  );
  return fans.size >= CROWD_MIN_FANS;
}
