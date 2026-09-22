import AsyncStorage from '@react-native-async-storage/async-storage';

import { dateLabel, formatDate } from '../dateLabel';
import { FALLBACK_CARDS } from '../fallback';
import {
  CACHE_KEY,
  fetchedRecently,
  readWallCache,
  refreshWallCache,
  usableCache,
} from '../payload';
import { parseWelcomeWall, WALL_CARD_COUNT } from '../types';

/** A payload exactly as `welcome_wall_current()` writes it. */
function wire(over: Record<string, unknown> = {}) {
  const card = (i: number, o: Record<string, unknown> = {}) => ({
    game_id: `g${i}`,
    sport: 'mlb',
    title: `Phillies ${i + 3}, Mets 2`,
    venue: 'Citi Field',
    played_on: '2026-09-20',
    night: true,
    date_label: 'Last night',
    result: i % 3 === 2 ? 'L' : 'W',
    team_id: '00000000-0000-4000-8000-000000000001',
    team_key: ['mlb:143', 'nflverse:DAL', 'mlb:119', 'mlb:147', 'nflverse:PHI', 'nba:1610612747'][i],
    score: 120,
    reasons: ['moment'],
    ...o,
  });
  return {
    week_start: '2026-09-21',
    updated_at: '2026-09-21T13:00:02.000Z',
    cards: [0, 1, 2, 3, 4, 5].map((i) => card(i)),
    ...over,
  };
}

describe('parseWelcomeWall', () => {
  it('accepts the shape the job writes and drops what the card does not draw', () => {
    const p = parseWelcomeWall(wire());
    expect(p).not.toBeNull();
    expect(p?.cards).toHaveLength(WALL_CARD_COUNT);
    expect(p?.cards[0]).toEqual({
      gameId: 'g0',
      sport: 'mlb',
      title: 'Phillies 3, Mets 2',
      venue: 'Citi Field',
      playedOn: '2026-09-20',
      night: true,
      dateLabel: 'Last night',
      result: 'W',
      teamKey: 'mlb:143',
    });
    // score, reasons and team_id are for people reading the table, not for the card.
    expect(p?.cards[0]).not.toHaveProperty('score');
  });

  it.each([
    ['not an object', 'nope'],
    ['five cards', wire({ cards: wire().cards.slice(0, 5) })],
    ['seven cards', wire({ cards: [...wire().cards, wire().cards[0]] })],
    ['a result that is not W or L', wire({ cards: [{ ...wire().cards[0], result: 'T' }, ...wire().cards.slice(1)] })],
    ['a team we have no colour for', wire({ cards: [{ ...wire().cards[0], team_key: 'mlb:9999' }, ...wire().cards.slice(1)] })],
    ['a title long enough to break the card', wire({ cards: [{ ...wire().cards[0], title: 'x'.repeat(41) }, ...wire().cards.slice(1)] })],
    ['a bad date', wire({ cards: [{ ...wire().cards[0], played_on: 'Sunday' }, ...wire().cards.slice(1)] })],
    ['an unknown sport', wire({ cards: [{ ...wire().cards[0], sport: 'nhl' }, ...wire().cards.slice(1)] })],
    ['no updated_at', wire({ updated_at: undefined })],
  ])('rejects %s', (_label, raw) => {
    expect(parseWelcomeWall(raw)).toBeNull();
  });

  it('the bundled fallback set is six cards whose colours are known', () => {
    expect(FALLBACK_CARDS).toHaveLength(WALL_CARD_COUNT);
    for (const c of FALLBACK_CARDS) expect(c.fill).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('dateLabel', () => {
  it.each([
    ['2026-09-20', true, '2026-09-21', 'Last night'],
    ['2026-09-20', false, '2026-09-21', 'Yesterday'],
    ['2026-09-20', false, '2026-09-22', 'Sunday'],
    ['2026-09-21', true, '2026-09-24', 'Monday night'],
    ['2026-09-13', true, '2026-09-21', 'Sep 13, 2026'],
    ['2026-09-21', true, '2026-09-21', 'Sep 21, 2026'],
    ['2026-12-31', false, '2027-01-02', 'Thursday'],
  ])('%s (night %s) read on %s is "%s"', (played, night, today, label) => {
    expect(dateLabel(played, night, today)).toBe(label);
  });

  it('formats a date the way the reference writes one', () => {
    expect(formatDate('2026-09-20')).toBe('Sep 20, 2026');
    expect(formatDate('2026-01-05')).toBe('Jan 5, 2026');
  });
});

describe('the cache', () => {
  const NOW = new Date('2026-09-23T12:00:00Z');
  beforeEach(() => AsyncStorage.clear());

  it('a valid, fresh payload is used', () => {
    const raw = JSON.stringify({ fetchedAt: NOW.toISOString(), payload: wire() });
    expect(usableCache(raw, NOW)?.cards).toHaveLength(6);
  });

  it('a payload older than 14 days is ignored in favour of the bundle', () => {
    const raw = JSON.stringify({ fetchedAt: NOW.toISOString(), payload: wire() });
    expect(usableCache(raw, new Date('2026-10-06T12:00:00Z'))).toBeNull();
    expect(usableCache(raw, new Date('2026-10-04T12:00:00Z'))).not.toBeNull();
  });

  it('a malformed cache is ignored', () => {
    expect(usableCache('{not json', NOW)).toBeNull();
    expect(usableCache(JSON.stringify({ fetchedAt: NOW.toISOString(), payload: { cards: [] } }), NOW)).toBeNull();
    expect(usableCache(null, NOW)).toBeNull();
  });

  it('refresh fetches, validates and caches; then waits six hours before asking again', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify(wire()), { status: 200 }));
    expect(await refreshWallCache(NOW, fetchImpl as unknown as typeof fetch)).toBe('cached');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((await readWallCache(NOW))?.weekStart).toBe('2026-09-21');

    expect(await refreshWallCache(new Date(NOW.getTime() + 5 * 3_600_000), fetchImpl as unknown as typeof fetch)).toBe('skipped');
    expect(await refreshWallCache(new Date(NOW.getTime() + 7 * 3_600_000), fetchImpl as unknown as typeof fetch)).toBe('cached');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('a malformed answer is rejected and the cache left alone', async () => {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: '2026-09-01T00:00:00Z', payload: wire() }));
    const bad = jest.fn(async () => new Response(JSON.stringify({ cards: 'six' }), { status: 200 }));
    expect(await refreshWallCache(NOW, bad as unknown as typeof fetch)).toBe('rejected');
    expect((await readWallCache(NOW))?.weekStart).toBe('2026-09-21');
  });

  it('no network falls back to the cache, then the bundle', async () => {
    const down = jest.fn(async () => {
      throw new Error('offline');
    });
    expect(await refreshWallCache(NOW, down as unknown as typeof fetch)).toBe('failed');
    expect(await readWallCache(NOW)).toBeNull();
    expect(fetchedRecently(null, NOW)).toBe(false);
  });
});
