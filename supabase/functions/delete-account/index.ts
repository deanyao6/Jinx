/**
 * delete-account: removes the caller's stored ticket images, then deletes the auth user, which
 * cascades through every user table (SPEC.md 9, 11). Auth: the user's JWT.
 */
import { createClient } from '@supabase/supabase-js';

import { json } from '../_shared/db.ts';

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('authorization') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: paths } = await userClient.rpc('my_storage_paths');
  const list = (paths ?? []) as string[];
  if (list.length > 0) {
    const { error: rmErr } = await admin.storage.from('ticket-imports').remove(list);
    if (rmErr) console.error('storage cleanup failed', rmErr.message);
  }
  // Anything else under the user's folder (e.g. avatars) is removed too.
  const { data: objects } = await admin.storage
    .from('ticket-imports')
    .list(userId, { limit: 1000 });
  const rest = (objects ?? []).map((o) => `${userId}/${o.name}`);
  if (rest.length > 0) await admin.storage.from('ticket-imports').remove(rest);

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) return json({ error: delErr.message }, 500);
  return json({ ok: true });
});
