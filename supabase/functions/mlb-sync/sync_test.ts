import { assertEquals } from 'jsr:@std/assert@1';

import type { MlbProvider } from '../_shared/core/index.ts';
import { memoryDb } from '../_shared/memory_db.ts';
import { dueForRecheck, loggedGameIds, runMlbSync, syncWindow } from './sync.ts';

Deno.test('syncWindow spans 3 days back and 14 forward', () => {
  const w = syncWindow(new Date('2026-09-15T12:00:00Z'));
  assertEquals(w, { start: '2026-09-12', end: '2026-09-29' });
});

Deno.test('syncWindow crosses month boundaries', () => {
  const w = syncWindow(new Date('2026-10-01T03:00:00Z'));
  assertEquals(w.start, '2026-09-28');
  assertEquals(w.end, '2026-10-15');
});

const NOW = new Date('2026-09-17T18:00:00Z');
const YESTERDAY = '2026-09-16T23:05:00Z'; // 19 hours before NOW

function final(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    provider: 'mlb',
    provider_game_id: `pk-${id}`,
    status: 'final',
    scheduled_start: YESTERDAY,
    detail_ingested_at: null,
    detail_rechecked_at: null,
    ...over,
  };
}

/** Records what was asked of the MLB API. Rejecting keeps the test out of the detail writer. */
function recordingProvider() {
  const fetched: string[] = [];
  const provider = {
    fetchSchedule: () => Promise.resolve([]),
    fetchGameDetail: (pk: string) => {
      fetched.push(pk);
      return Promise.reject(new Error('stop here'));
    },
  } as unknown as MlbProvider;
  return { provider, fetched };
}

Deno.test('dueForRecheck waits 16 hours from the start, and only for an early first fetch', () => {
  const row = (ingested: string) => ({
    id: 'g',
    provider_game_id: 'pk',
    scheduled_start: YESTERDAY,
    detail_ingested_at: ingested,
  });
  assertEquals(dueForRecheck(row('2026-09-17T02:30:00Z'), NOW), true);
  // Too soon: corrections may not be in yet.
  assertEquals(dueForRecheck(row('2026-09-17T02:30:00Z'), new Date('2026-09-17T10:00:00Z')), false);
  // Logged days later, so the first fetch already had the corrections.
  assertEquals(dueForRecheck(row('2026-09-17T17:00:00Z'), NOW), false);
});

Deno.test('a final nobody logged gets no detail, however recent', async () => {
  const db = memoryDb({
    teams: [],
    venues: [],
    games: [final('unlogged-1'), final('unlogged-2'), final('unlogged-3')],
    detail_queue: [],
    attendances: [],
  });
  const { provider, fetched } = recordingProvider();
  const result = await runMlbSync(db, provider, NOW);
  assertEquals(fetched, []);
  assertEquals(result, { scheduled: 0, rechecked: [], errors: [] });
});

Deno.test('a logged final without detail is left to the queue, not fetched here', async () => {
  const db = memoryDb({
    teams: [],
    venues: [],
    games: [final('logged')],
    detail_queue: [{ game_id: 'logged', done_at: null }],
    attendances: [{ id: 'a1', game_id: 'logged', status: 'attended' }],
  });
  const { provider, fetched } = recordingProvider();
  await runMlbSync(db, provider, NOW);
  assertEquals(fetched, []);
});

Deno.test('the correction pass re-fetches logged games only', async () => {
  const early = { detail_ingested_at: '2026-09-17T02:30:00Z' };
  const db = memoryDb({
    teams: [],
    venues: [],
    games: [
      final('queued', early),
      final('attended-never-queued', early),
      final('detailed-before-the-fix', early),
      final('already-rechecked', { ...early, detail_rechecked_at: '2026-09-17T16:00:00Z' }),
    ],
    detail_queue: [
      { game_id: 'queued', done_at: '2026-09-17T02:30:00Z' },
      { game_id: 'already-rechecked', done_at: '2026-09-17T02:30:00Z' },
    ],
    attendances: [{ id: 'a1', game_id: 'attended-never-queued', status: 'attended' }],
  });
  const { provider, fetched } = recordingProvider();
  await runMlbSync(db, provider, NOW);
  assertEquals(fetched.sort(), ['pk-attended-never-queued', 'pk-queued']);
});

Deno.test('loggedGameIds asks attendances only about games the queue does not know', async () => {
  const db = memoryDb({
    detail_queue: [{ game_id: 'q' }],
    attendances: [
      { id: '1', game_id: 'a', status: 'attended' },
      { id: '2', game_id: 'q', status: 'attended' },
    ],
  });
  const logged = await loggedGameIds(db, ['q', 'a', 'nobody']);
  assertEquals([...logged].sort(), ['a', 'q']);
  assertEquals(
    db.requests.map((r) => r.table),
    ['detail_queue', 'attendances', 'attendances'],
  );
});
