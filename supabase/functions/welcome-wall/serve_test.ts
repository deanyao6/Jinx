import { assertEquals, assertMatch } from 'jsr:@std/assert@1';

import { memoryDb } from '../_shared/memory_db.ts';
import { MAX_BYTES, RATE_LIMIT, rateLimited, serveWelcomeWall } from './serve.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const CARDS = {
  week_start: '2026-09-21',
  updated_at: '2026-09-21T13:00:02Z',
  cards: [
    {
      game_id: '1',
      sport: 'mlb',
      title: 'Phillies 7, Mets 2',
      venue: 'Citi Field',
      played_on: '2026-09-20',
      night: true,
      date_label: 'Last night',
      result: 'W',
      team_id: 'x',
      team_key: 'mlb:143',
    },
  ],
};

Deno.test('GET serves the current week with a six-hour cache header', async () => {
  const db = memoryDb({}, { welcome_wall_current: () => CARDS });
  const res = await serveWelcomeWall(new Request('http://x/welcome-wall'), () => db, json);
  assertEquals(res.status, 200);
  assertMatch(res.headers.get('cache-control') ?? '', /max-age=21600/);
  assertEquals(await res.json(), CARDS);
});

Deno.test('anything but GET is refused', async () => {
  const db = memoryDb({}, { welcome_wall_current: () => CARDS });
  const res = await serveWelcomeWall(
    new Request('http://x/welcome-wall', { method: 'POST' }),
    () => db,
    json,
  );
  assertEquals(res.status, 405);
});

Deno.test('no cards yet is a 404, not an empty wall', async () => {
  const db = memoryDb({}, { welcome_wall_current: () => null });
  const res = await serveWelcomeWall(new Request('http://x/welcome-wall'), () => db, json);
  assertEquals(res.status, 404);
});

Deno.test('a payload past the cap is refused rather than served', async () => {
  const db = memoryDb(
    {},
    {
      welcome_wall_current: () => ({ ...CARDS, cards: Array(200).fill(CARDS.cards[0]) }),
    },
  );
  const res = await serveWelcomeWall(new Request('http://x/welcome-wall'), () => db, json);
  assertEquals(res.status, 500);
  assertEquals(JSON.stringify(CARDS).length < MAX_BYTES, true);
});

Deno.test('an IP is limited after RATE_LIMIT requests in a minute, and freed after it', () => {
  const t0 = 1_000_000;
  for (let i = 0; i < RATE_LIMIT; i++) assertEquals(rateLimited('10.0.0.9', t0 + i), false);
  assertEquals(rateLimited('10.0.0.9', t0 + RATE_LIMIT), true);
  assertEquals(rateLimited('10.0.0.8', t0 + RATE_LIMIT), false);
  assertEquals(rateLimited('10.0.0.9', t0 + 60_001), false);
});
