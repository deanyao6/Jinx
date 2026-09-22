import type { MinimalDb } from '../_shared/core/index.ts';

/** How long the CDN and the app may keep an answer. Six hours, per the spec. */
export const CACHE_SECONDS = 6 * 60 * 60;

/** Requests one IP may make per minute before it is told to wait. */
export const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

/** A payload larger than this is a bug, not a wall: the app would refuse it anyway. */
export const MAX_BYTES = 8 * 1024;

type Json = (body: unknown, status?: number) => Response;

const hits = new Map<string, { count: number; since: number }>();

/**
 * True when this IP has already used its minute. In-memory, per isolate: enough to stop one
 * client hammering the database, which is all it is for.
 */
export function rateLimited(ip: string, now = Date.now()): boolean {
  const h = hits.get(ip);
  if (!h || now - h.since >= RATE_WINDOW_MS) {
    hits.set(ip, { count: 1, since: now });
    if (hits.size > 10_000) hits.clear();
    return false;
  }
  h.count += 1;
  return h.count > RATE_LIMIT;
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';
}

export async function serveWelcomeWall(
  req: Request,
  db: () => MinimalDb,
  json: Json,
): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);
  if (rateLimited(clientIp(req))) {
    return new Response(JSON.stringify({ error: 'too many requests' }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': '60' },
    });
  }

  const { data, error } = await db().rpc('welcome_wall_current');
  if (error) return json({ error: 'unavailable' }, 503);
  // A week with no rows answers null from SQL; anything that is not one object is no wall.
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return json({ error: 'no cards yet' }, 404);
  }

  const body = JSON.stringify(data);
  if (body.length > MAX_BYTES) return json({ error: 'payload too large' }, 500);

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
      'access-control-allow-origin': '*',
    },
  });
}
