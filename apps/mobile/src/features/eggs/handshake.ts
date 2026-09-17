import { eggs } from './flags';

/**
 * The secret handshake (Dean, 2026-09-17). Two people who follow each other and are both checked
 * in to one game each tap the other's avatar on its "Also there" list. When both have, inside the
 * check-in window, both get a "We were there" card.
 *
 * Pure rules only. The server decides who may shake hands (`offer_handshake` in
 * supabase/migrations/20260917000800_handshakes.sql); this file only reads its answers. The
 * secret is kept there too: nothing the app can ask for says that somebody has offered you a
 * handshake until you offer one back.
 */

export type HandshakeState = 'waiting' | 'complete';

/** A row of `my_handshakes`: somebody the caller has offered to. */
export type HandshakeRow = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_path: string | null;
  state: string;
  offered_at?: string | null;
  completed_at?: string | null;
};

export type OfferResult = { offered: true; complete: boolean } | { offered: false; reason: string };

type Flags = { readonly secretHandshake: boolean };

/** How often to ask whether a waiting handshake has been returned. */
export const HANDSHAKE_POLL_MS = 15_000;

/** Reads `offer_handshake`'s jsonb. Anything unexpected is a refusal, never a handshake. */
export function parseOfferResult(data: unknown): OfferResult {
  const r = (data ?? {}) as Record<string, unknown>;
  if (r['offered'] === true) return { offered: true, complete: r['complete'] === true };
  return { offered: false, reason: typeof r['reason'] === 'string' ? r['reason'] : 'unknown' };
}

/** Why an offer was refused, for the person who made it. Never says "blocked": the server does not. */
export function offerRefusalCopy(reason: string): string {
  switch (reason) {
    case 'not_checked_in':
      return 'Check in to this game first.';
    case 'they_are_not_checked_in':
      return 'They have not checked in to this game.';
    case 'not_mutual':
      return 'You two need to follow each other.';
    case 'outside_window':
      return 'Check-in for this game has closed.';
    default:
      return 'That did not go through. Try again.';
  }
}

/** Who the caller has offered to, and where each offer stands. */
export function handshakeStates(
  rows: readonly HandshakeRow[] | null | undefined,
): ReadonlyMap<string, HandshakeState> {
  const out = new Map<string, HandshakeState>();
  for (const row of rows ?? []) {
    out.set(row.user_id, row.state === 'complete' ? 'complete' : 'waiting');
  }
  return out;
}

export function completedHandshakes(
  rows: readonly HandshakeRow[] | null | undefined,
): HandshakeRow[] {
  return (rows ?? []).filter((row) => row.state === 'complete');
}

/**
 * The handshakes that were waiting last time and are complete now: the moment to present the
 * card. One already complete when the screen opened is not news, and is not in here.
 */
export function newlyCompleted(
  before: ReadonlyMap<string, HandshakeState> | null,
  rows: readonly HandshakeRow[] | null | undefined,
): HandshakeRow[] {
  if (!before) return [];
  return completedHandshakes(rows).filter((row) => before.get(row.user_id) === 'waiting');
}

/**
 * Whether the screen should keep asking. Only while it is focused, the check-in window is open
 * and an offer of the caller's is still unanswered: with nothing waiting, nothing the caller is
 * allowed to see can change without their own tap.
 */
export function handshakePollInterval(
  input: {
    focused: boolean;
    windowOpen: boolean;
    rows: readonly HandshakeRow[] | null | undefined;
  },
  flags: Flags = eggs,
): number | false {
  if (!flags.secretHandshake || !input.focused || !input.windowOpen) return false;
  const waiting = (input.rows ?? []).some((row) => row.state !== 'complete');
  return waiting ? HANDSHAKE_POLL_MS : false;
}

export function handshakeName(row: Pick<HandshakeRow, 'display_name' | 'handle'>): string {
  return row.display_name?.trim() || (row.handle ? `@${row.handle}` : 'a friend');
}

/** "Secret handshake with Maya." and, for two or more, "Secret handshake with Maya and Sam." */
export function handshakeLine(rows: readonly HandshakeRow[]): string | null {
  const names = rows.map(handshakeName);
  if (names.length === 0) return null;
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] as string}`;
  return `Secret handshake with ${list}.`;
}

/** Whether an avatar on the list can be tapped at all. */
export function canOfferHandshake(
  input: {
    live: boolean;
    viewerCheckedIn: boolean;
    windowOpen: boolean;
    isCandidate: boolean;
    state: HandshakeState | undefined;
  },
  flags: Flags = eggs,
): boolean {
  return (
    flags.secretHandshake &&
    input.live &&
    input.viewerCheckedIn &&
    input.windowOpen &&
    input.isCandidate &&
    input.state === undefined
  );
}
