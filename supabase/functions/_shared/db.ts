import { createClient } from '@supabase/supabase-js';

import { asDb, type MinimalDb } from './core/index.ts';

/** Service-role client for Edge Functions (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the runtime). */
export function serviceDb(): MinimalDb {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
  return asDb(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
}

/** Allows calls that carry the service role key (pg_cron) or the shared CRON_SECRET header. */
export function authorizeInternal(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secret = Deno.env.get('CRON_SECRET');
  if (key && auth === `Bearer ${key}`) return true;
  if (secret && req.headers.get('x-cron-secret') === secret) return true;
  return false;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
