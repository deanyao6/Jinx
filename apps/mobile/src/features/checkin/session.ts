import type { GameContext } from './queries';

/**
 * Whether the fan is at the game right now: checked in, and the session has not ended. Pick a
 * side and the handshake exist only inside an open session (docs/prompts/social/00, R4).
 */
export function inOpenSession(ctx: Pick<GameContext, 'checked_in_at' | 'checkin'> | null | undefined): boolean {
  if (!ctx?.checked_in_at) return false;
  return ctx.checkin?.open ?? true;
}
