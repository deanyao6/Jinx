/**
 * Offline captures (03, section 1: stadium cell service is bad). A capture that cannot be posted
 * is kept on disk and posted when the app is next online, with the two photos still in the
 * app's cache. Lateness is the server's clock against the prompt, so a queued capture posts
 * "late by 4 min" on its own; nothing here has to remember when it was taken.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CaptureInput } from './queries';

export const QUEUE_KEY = 'jinx-reaction-queue';

export type QueuedCapture = CaptureInput & { queuedAt: string; attempts: number };

export async function readQueue(): Promise<QueuedCapture[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedCapture[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedCapture[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueCapture(input: CaptureInput, now = new Date()): Promise<void> {
  const items = await readQueue();
  items.push({ ...input, queuedAt: now.toISOString(), attempts: 0 });
  await writeQueue(items);
}

/** A capture older than this is dropped rather than posted a week late. */
export const QUEUE_MAX_AGE_MS = 3 * 24 * 60 * 60_000;

/**
 * Posts what it can, keeps what it cannot. Returns how many posted and how many remain. A
 * capture is dropped once it is too old or has failed for a reason that will not change (the
 * server refused it), never for a network failure.
 */
export async function flushQueue(
  post: (input: CaptureInput) => Promise<unknown>,
  now = new Date(),
): Promise<{ posted: number; remaining: number }> {
  const items = await readQueue();
  const keep: QueuedCapture[] = [];
  let posted = 0;
  for (const item of items) {
    if (now.getTime() - Date.parse(item.queuedAt) > QUEUE_MAX_AGE_MS) continue;
    try {
      await post(item);
      posted += 1;
    } catch (e) {
      if (isPermanent(e)) continue;
      keep.push({ ...item, attempts: item.attempts + 1 });
    }
  }
  await writeQueue(keep);
  return { posted, remaining: keep.length };
}

/** A Postgres error code means the server answered and said no; anything else may be the network. */
export function isPermanent(e: unknown): boolean {
  const code = (e as { code?: unknown })?.code;
  return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code);
}
