/**
 * delete-account: removes everything the caller stored, then deletes the auth user, which
 * cascades through every user table (SPEC.md 9, 11). Auth: the user's JWT.
 *
 * Storage goes first and a failure there stops the deletion. Storage objects are not reached by
 * the cascade, so once the user row is gone nothing would ever point at a leftover ticket image
 * or photo again; failing loudly while the account still exists lets the user simply retry.
 */
import { createClient } from '@supabase/supabase-js';

import { json } from '../_shared/db.ts';
import { removeUserObjects, USER_BUCKETS } from '../_shared/storage.ts';

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
  const removed: Record<string, number> = {};
  try {
    for (const bucket of USER_BUCKETS)
      removed[bucket] = await removeUserObjects(admin, bucket, userId);
  } catch (err) {
    console.error('storage cleanup failed', err);
    return json(
      { error: 'Could not remove your stored files. Nothing was deleted; try again.' },
      500,
    );
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) return json({ error: delErr.message }, 500);
  return json({ ok: true, removed });
});
