import { assertEquals } from 'jsr:@std/assert@1';

import type { TeamName, ValidationContext } from '../_shared/core/index.ts';
import { memoryDb } from '../_shared/memory_db.ts';
import { existingStorylines, storeSlot } from './store.ts';

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

const slot = { gameId: 'g1', teamId: 'phi', source: 'results' as const };
const facts = (streak: number) => ({
  team: 'Phillies',
  opponent: 'Mets',
  atHome: true,
  season: 2026,
  seasonRecord: { wins: 90, losses: 60, ties: 0 },
  streak,
  venueRecord: { wins: 48, losses: 27, ties: 0 },
});
const stored = (text: string) => ({
  game_id: 'g1',
  team_id: 'phi',
  text,
  source: 'results',
  facts: facts(5),
});
const MORNING = 'The Phillies have won 5 straight.';

Deno.test('a failed run keeps the sentence that is still true', async () => {
  const db = memoryDb({ storylines: [stored(MORNING)] });
  const existing = await existingStorylines(db, 'g1');
  const action = await storeSlot(db, slot, {
    facts: facts(5),
    generated: null,
    existingText: existing.get('phi') ?? null,
    ctx,
  });
  assertEquals(action, 'keep');
  assertEquals(
    db.tables.storylines.map((r) => r.text),
    [MORNING],
  );
  // And nothing was deleted on the way: the only request was the read.
  assertEquals(
    db.requests.map((r) => r.op),
    ['select'],
  );
});

Deno.test('a failed run removes a sentence the facts no longer support', async () => {
  // They lost the first game of a doubleheader; "5 straight" is now wrong and nothing replaced it.
  const db = memoryDb({ storylines: [stored(MORNING)] });
  const action = await storeSlot(db, slot, {
    facts: facts(-1),
    generated: null,
    existingText: MORNING,
    ctx,
  });
  assertEquals(action, 'remove');
  assertEquals(db.tables.storylines, []);
});

Deno.test('a new sentence replaces the old one in place, other slots untouched', async () => {
  const db = memoryDb({
    storylines: [
      stored(MORNING),
      { game_id: 'g1', team_id: null, text: 'Game line.', source: 'schedule', facts: {} },
      { game_id: 'g2', team_id: 'phi', text: 'Another game.', source: 'results', facts: {} },
    ],
  });
  const action = await storeSlot(db, slot, {
    facts: facts(6),
    generated: 'The Phillies have won 6 straight.',
    existingText: MORNING,
    ctx,
  });
  assertEquals(action, 'write');
  assertEquals(
    db.tables.storylines.map((r) => r.text),
    ['The Phillies have won 6 straight.', 'Game line.', 'Another game.'],
  );
  assertEquals(
    db.requests.some((r) => r.op === 'delete'),
    false,
  );
});

Deno.test('removing the game slot leaves the team slots alone', async () => {
  const db = memoryDb({
    storylines: [
      stored(MORNING),
      { game_id: 'g1', team_id: null, text: 'Game line.', source: 'schedule', facts: {} },
    ],
  });
  const action = await storeSlot(
    db,
    { gameId: 'g1', teamId: null, source: 'schedule' },
    { facts: null, generated: null, existingText: 'Game line.', ctx: { ...ctx, subject: null } },
  );
  assertEquals(action, 'remove');
  assertEquals(
    db.tables.storylines.map((r) => r.text),
    [MORNING],
  );
});
