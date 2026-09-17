import { describe, expect, it } from 'vitest';

import { settleSlot } from './refresh.js';
import type { TeamName, ValidationContext } from './validate.js';

const phillies: TeamName = {
  name: 'Philadelphia Phillies',
  city: 'Philadelphia',
  nickname: 'Phillies',
};
const mets: TeamName = { name: 'New York Mets', city: 'Flushing', nickname: 'Mets' };
const ctx: ValidationContext = {
  teams: [phillies, mets],
  league: [phillies, mets],
  subject: phillies,
};

const facts = (streak: number) => ({
  team: 'Phillies',
  opponent: 'Mets',
  atHome: true,
  season: 2026,
  seasonRecord: { wins: 90, losses: 60, ties: 0 },
  streak,
  venueRecord: { wins: 48, losses: 27, ties: 0 },
});
const MORNING = 'The Phillies have won 5 straight.';

describe('settleSlot', () => {
  it('writes a sentence that passed, whatever was there', () => {
    const generated = 'The Phillies are 90-60.';
    expect(settleSlot({ facts: facts(5), generated, existingText: MORNING, ctx })).toEqual({
      action: 'write',
      text: generated,
    });
    expect(settleSlot({ facts: facts(5), generated, existingText: null, ctx })).toEqual({
      action: 'write',
      text: generated,
    });
  });

  it('keeps the stored sentence when the run produced nothing and it is still true', () => {
    expect(settleSlot({ facts: facts(5), generated: null, existingText: MORNING, ctx })).toEqual({
      action: 'keep',
    });
  });

  it('removes the stored sentence when the run produced nothing and it is no longer true', () => {
    expect(settleSlot({ facts: facts(-1), generated: null, existingText: MORNING, ctx })).toEqual({
      action: 'remove',
    });
  });

  it('removes the stored sentence when there is nothing to say any more', () => {
    expect(settleSlot({ facts: null, generated: null, existingText: MORNING, ctx })).toEqual({
      action: 'remove',
    });
  });

  it('does nothing to an empty slot that stays empty', () => {
    expect(settleSlot({ facts: facts(5), generated: null, existingText: null, ctx })).toEqual({
      action: 'none',
    });
    expect(settleSlot({ facts: null, generated: null, existingText: null, ctx })).toEqual({
      action: 'none',
    });
  });
});
