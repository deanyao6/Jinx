import AsyncStorage from '@react-native-async-storage/async-storage';

import { bannerDelivery, BANNER_MS } from '../ui/PromptBanner';
import { enqueueCapture, flushQueue, isPermanent, readQueue, QUEUE_KEY } from '../queue';
import { reminderCopy, remindersWanted } from '../reminders';
import type { CaptureInput, PromptDelivery } from '../queries';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-notifications', () => ({}));

const capture: CaptureInput = { gameId: 'g', attendanceId: 'a', promptId: 'p', backUri: 'file:///b.jpg', frontUri: 'file:///f.jpg', visibility: 'followers', periodLabel: 'Q4 1:52' };

describe('the offline queue', () => {
  beforeEach(() => AsyncStorage.clear());

  it('keeps a capture and posts it later; a network failure keeps it, a refusal drops it', async () => {
    await enqueueCapture(capture, new Date('2026-09-24T02:00:00Z'));
    expect(await readQueue()).toHaveLength(1);
    const network = await flushQueue(async () => { throw new Error('Network request failed'); }, new Date('2026-09-24T02:05:00Z'));
    expect(network).toEqual({ posted: 0, remaining: 1 });
    expect((await readQueue())[0]?.attempts).toBe(1);
    const refused = await flushQueue(async () => { throw Object.assign(new Error('rls'), { code: '42501' }); }, new Date('2026-09-24T02:06:00Z'));
    expect(refused).toEqual({ posted: 0, remaining: 0 });
    await enqueueCapture(capture, new Date('2026-09-24T02:00:00Z'));
    const posted: CaptureInput[] = [];
    expect(await flushQueue(async (i) => { posted.push(i); }, new Date('2026-09-24T02:07:00Z'))).toEqual({ posted: 1, remaining: 0 });
    expect(posted[0]).toMatchObject({ gameId: 'g', promptId: 'p' });
  });

  it('drops a capture older than three days rather than posting it a week late', async () => {
    await enqueueCapture(capture, new Date('2026-09-20T02:00:00Z'));
    expect(await flushQueue(async () => {}, new Date('2026-09-24T02:00:00Z'))).toEqual({ posted: 0, remaining: 0 });
  });

  it('survives a corrupt store', async () => {
    await AsyncStorage.setItem(QUEUE_KEY, '{not json');
    expect(await readQueue()).toEqual([]);
    expect(isPermanent({ code: '23514' })).toBe(true);
    expect(isPermanent(new Error('Network request failed'))).toBe(false);
  });
});

describe('the in-app banner', () => {
  const d = (over: Partial<PromptDelivery>): PromptDelivery => ({
    prompt_id: 'p1', user_id: 'u', game_id: 'g', fired_at: '2026-09-24T02:00:00Z', copy: 'Quick, react to Touchdown, Eagles.', opened_at: null, reacted_at: null, prompt: null, ...over,
  });
  const now = Date.parse('2026-09-24T02:01:00Z');
  it('shows the newest unanswered prompt inside its window, and not one dismissed, opened, or stale', () => {
    expect(bannerDelivery([d({})], now, new Set())?.prompt_id).toBe('p1');
    expect(bannerDelivery([d({}), d({ prompt_id: 'p2', fired_at: '2026-09-24T02:00:30Z' })], now, new Set())?.prompt_id).toBe('p2');
    expect(bannerDelivery([d({})], now, new Set(['p1']))).toBeNull();
    expect(bannerDelivery([d({ opened_at: '2026-09-24T02:00:10Z' })], now, new Set())).toBeNull();
    expect(bannerDelivery([d({})], now + BANNER_MS + 1000, new Set())).toBeNull();
    expect(bannerDelivery(undefined, now, new Set())).toBeNull();
  });
});

describe('the 30-minute reminders', () => {
  const g = (id: string, start: string) => ({ id, scheduled_start: start, home: 'Phillies', away: 'Mets', venue: 'Citizens Bank Park' });
  it('wants games still ahead within a week whose reminder time has not passed', () => {
    const now = Date.parse('2026-09-24T12:00:00Z');
    const wanted = remindersWanted(
      [g('soon', '2026-09-24T23:05:00Z'), g('past', '2026-09-24T12:20:00Z'), g('far', '2026-10-10T23:05:00Z'), g('done', '2026-09-23T23:05:00Z')],
      now,
    );
    expect(wanted.map((x) => x.id)).toEqual(['soon']);
    expect(reminderCopy(g('soon', '2026-09-24T23:05:00Z'))).toEqual({
      title: 'Mets at Phillies starts in 30 minutes',
      body: 'At Citizens Bank Park? Check in when you are inside.',
    });
  });
});
