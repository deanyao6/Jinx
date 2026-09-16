import { assertEquals } from 'jsr:@std/assert@1';

import { syncWindow } from './sync.ts';

Deno.test('syncWindow spans 3 days back and 14 forward', () => {
  const w = syncWindow(new Date('2026-09-15T12:00:00Z'));
  assertEquals(w, { start: '2026-09-12', end: '2026-09-29' });
});

Deno.test('syncWindow crosses month boundaries', () => {
  const w = syncWindow(new Date('2026-10-01T03:00:00Z'));
  assertEquals(w.start, '2026-09-28');
  assertEquals(w.end, '2026-10-15');
});
