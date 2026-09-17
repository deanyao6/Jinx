/**
 * Writes one storyline slot, without ever leaving it empty in between (SPEC.md 6.18).
 *
 * The decision is `settleSlot` in packages/core; this is the part that touches the database. A
 * new sentence goes in as an upsert on the slot's unique index, which is one statement: there is
 * no moment at which the old one is gone and the new one is not there yet.
 */
import {
  settleSlot,
  type MinimalDb,
  type SlotDecision,
  type ValidationContext,
} from '../_shared/core/index.ts';

export interface Slot {
  gameId: string;
  /** Null for the storyline about the game itself. */
  teamId: string | null;
  source: 'results' | 'schedule';
}

/** The sentences a game has now, keyed by team id, with '' for the one about the game. */
export async function existingStorylines(
  db: MinimalDb,
  gameId: string,
): Promise<Map<string, string>> {
  const { data, error } = await db.from('storylines').select('team_id, text').eq('game_id', gameId);
  if (error) throw new Error(error.message);
  return new Map(
    ((data ?? []) as { team_id: string | null; text: string }[]).map((r) => [
      r.team_id ?? '',
      r.text,
    ]),
  );
}

export async function storeSlot(
  db: MinimalDb,
  slot: Slot,
  input: {
    facts: unknown | null;
    generated: string | null;
    existingText: string | null;
    ctx: ValidationContext;
  },
  now = new Date(),
): Promise<SlotDecision['action']> {
  const decision = settleSlot(input);
  if (decision.action === 'write') {
    const { error } = await db.from('storylines').upsert(
      [
        {
          game_id: slot.gameId,
          team_id: slot.teamId,
          text: decision.text,
          source: slot.source,
          facts: input.facts as Record<string, unknown>,
          generated_at: now.toISOString(),
        },
      ],
      { onConflict: 'game_id,team_id' },
    );
    if (error) throw new Error(error.message);
  } else if (decision.action === 'remove') {
    const scoped = db.from('storylines').delete().eq('game_id', slot.gameId);
    const { error } = await (slot.teamId === null
      ? scoped.is('team_id', null)
      : scoped.eq('team_id', slot.teamId));
    if (error) throw new Error(error.message);
  }
  return decision.action;
}
