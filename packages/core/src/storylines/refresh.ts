/**
 * What a refresh does to one storyline slot (one team's, or the game's): SPEC.md 6.18.
 *
 * A refresh used to delete a game's storylines and then write whatever the model produced, so a
 * run where the model failed left the game with none. The rule now is per slot, and the stored
 * sentence is only ever replaced by a better one or removed because it stopped being true:
 *
 *   a new sentence passed validation          write it over the old one, in one statement
 *   none did, and the old one is still true   keep the old one
 *   none did, and the old one is now wrong    remove it: no storyline beats a wrong one
 *   the facts give nothing to say             remove whatever is there
 *
 * "Still true" is the same validator that admitted the sentence, run against today's facts. A
 * streak that ended between the morning run and the refresh fails it; an unchanged record passes.
 */
import { validateStoryline, type ValidationContext } from './validate.js';

export type SlotDecision =
  | { action: 'write'; text: string }
  | { action: 'keep' }
  | { action: 'remove' }
  | { action: 'none' };

export interface SlotInput {
  /** Today's facts for the slot, or null when there is nothing to say. */
  facts: unknown | null;
  /** The sentence that passed validation on this run, or null when none did. */
  generated: string | null;
  /** The sentence stored by an earlier run, or null when the slot is empty. */
  existingText: string | null;
  ctx: ValidationContext;
}

export function settleSlot(input: SlotInput): SlotDecision {
  const { facts, generated, existingText, ctx } = input;
  if (facts !== null && generated !== null) return { action: 'write', text: generated };
  if (existingText === null) return { action: 'none' };
  if (facts === null) return { action: 'remove' };
  return validateStoryline(existingText, facts, ctx).ok ? { action: 'keep' } : { action: 'remove' };
}
