import { assertEquals } from 'jsr:@std/assert@1';

import { MAX_ROWS, memoryDb } from '../_shared/memory_db.ts';
import { goingGamesInWindow } from './games.ts';

const from = new Date('2026-09-18T12:00:00Z');
const until = new Date('2026-09-19T08:00:00Z');

function game(id: string, start: string, status = 'scheduled') {
  return { id, status, scheduled_start: start };
}

Deno.test('a going game is found behind more than a thousand other going rows', async () => {
  // 1,500 people going to a game next month sort ahead of the one person going tonight. Reading
  // "every going attendance" stops at row 1,000 and tonight's game is never seen.
  const attendances = Array.from({ length: 1500 }, (_, i) => ({
    id: `a-${String(i).padStart(5, '0')}`,
    game_id: 'next-month',
    status: 'going',
  }));
  attendances.push({ id: 'z-last', game_id: 'tonight', status: 'going' });
  const db = memoryDb({
    games: [
      game('tonight', '2026-09-18T23:05:00Z'),
      game('next-month', '2026-10-20T23:05:00Z'),
      game('nobody-going', '2026-09-18T23:10:00Z'),
    ],
    attendances,
  });

  // The old query, for the record: it cannot see the game.
  const { data } = await db.from('attendances').select('game_id').eq('status', 'going');
  assertEquals(data?.length, MAX_ROWS);
  assertEquals(
    data?.some((r) => (r as { game_id: string }).game_id === 'tonight'),
    false,
  );

  const games = await goingGamesInWindow(db, from, until, 50);
  assertEquals(
    games.map((g) => g.id),
    ['tonight'],
  );
});

Deno.test('more than a thousand people going to games in the window are all read', async () => {
  // Game A fills the first page by itself; game B only shows up on the second.
  const attendances = [
    ...Array.from({ length: 1200 }, (_, i) => ({
      id: `a-${String(i).padStart(5, '0')}`,
      game_id: 'a',
      status: 'going',
    })),
    { id: 'b-00000', game_id: 'b', status: 'going' },
  ];
  const db = memoryDb({
    games: [game('b', '2026-09-18T20:05:00Z'), game('a', '2026-09-18T23:05:00Z')],
    attendances,
  });
  const games = await goingGamesInWindow(db, from, until, 50);
  assertEquals(
    games.map((g) => g.id),
    ['b', 'a'],
  );
});

Deno.test('attended rows, games outside the window and games under way do not count', async () => {
  const db = memoryDb({
    games: [
      game('in', '2026-09-18T23:05:00Z'),
      game('attended-only', '2026-09-18T23:05:00Z'),
      game('too-late', '2026-09-19T08:00:00Z'),
      game('live', '2026-09-18T18:05:00Z', 'live'),
    ],
    attendances: [
      { id: '1', game_id: 'in', status: 'going' },
      { id: '2', game_id: 'attended-only', status: 'attended' },
      { id: '3', game_id: 'too-late', status: 'going' },
      { id: '4', game_id: 'live', status: 'going' },
    ],
  });
  const games = await goingGamesInWindow(db, from, until, 50);
  assertEquals(
    games.map((g) => g.id),
    ['in'],
  );
});

Deno.test('the ceiling keeps the soonest games', async () => {
  const db = memoryDb({
    games: [
      game('third', '2026-09-19T02:05:00Z'),
      game('first', '2026-09-18T17:05:00Z'),
      game('second', '2026-09-18T23:05:00Z'),
    ],
    attendances: ['first', 'second', 'third'].map((g, i) => ({
      id: String(i),
      game_id: g,
      status: 'going',
    })),
  });
  const games = await goingGamesInWindow(db, from, until, 2);
  assertEquals(
    games.map((g) => g.id),
    ['first', 'second'],
  );
});
