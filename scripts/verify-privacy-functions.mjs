#!/usr/bin/env node
/**
 * Proves, against a running backend, that the two privacy functions really delete:
 *
 *   cleanup-imports   a ticket image is removed once its import has been resolved for longer
 *                     than the retention period, and a recent one is left alone (SPEC 7.2.6)
 *   delete-account    the auth user, every row they own and every stored file are gone (SPEC 9, 11)
 *
 * It only ever touches a throwaway user it creates itself (jinx-verify-<random>@example.com), and
 * removes that user again even when a check fails. It never reads or writes another account.
 *
 *   # local stack (functions must be served: npm run functions:serve)
 *   eval "$(npx supabase status -o env | sed 's/^/export /')"
 *   SUPABASE_URL=$API_URL SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
 *     CRON_SECRET=... node scripts/verify-privacy-functions.mjs
 *
 *   # hosted: the legacy service role JWT and anon JWT from `supabase projects api-keys`
 */
import { randomBytes, randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

const env = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`missing ${name}`);
    process.exit(2);
  }
  return v;
};
const URL = env('SUPABASE_URL');
const ANON = env('SUPABASE_ANON_KEY');
const SERVICE = env('SUPABASE_SERVICE_ROLE_KEY');
const CRON_SECRET = env('CRON_SECRET');

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

// A 1x1 PNG. The buckets only accept image types, and the content is irrelevant here.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

async function exists(bucket, path) {
  const dir = path.slice(0, path.lastIndexOf('/'));
  const name = path.slice(path.lastIndexOf('/') + 1);
  const { data, error } = await admin.storage.from(bucket).list(dir, { limit: 1000 });
  if (error) throw new Error(error.message);
  return (data ?? []).some((o) => o.name === name);
}

async function callInternal(name) {
  const res = await fetch(`${URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE}`,
      'x-cron-secret': CRON_SECRET,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  const email = `jinx-verify-${randomBytes(6).toString('hex')}@example.com`;
  const password = randomBytes(18).toString('base64url');
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw new Error(`create user: ${createError.message}`);
  const userId = created.user.id;
  console.log(`throwaway user ${email} (${userId})`);
  let deleted = false;

  try {
    // Some installs create the profile from a trigger and some in onboarding; make sure of it.
    const handle = `verify_${randomBytes(4).toString('hex')}`;
    const { error: profileError } = await admin
      .from('profiles')
      .upsert({ id: userId, handle, display_name: 'Verify' }, { onConflict: 'id' });
    if (profileError) throw new Error(`profile: ${profileError.message}`);

    // --- cleanup-imports -----------------------------------------------------------------
    const oldPath = `${userId}/${randomUUID()}.png`;
    const newPath = `${userId}/${randomUUID()}.png`;
    for (const p of [oldPath, newPath]) {
      const { error } = await admin.storage
        .from('ticket-imports')
        .upload(p, PNG, { contentType: 'image/png' });
      if (error) throw new Error(`upload ${p}: ${error.message}`);
    }
    const eightDaysAgo = new Date(Date.now() - 8 * 86_400_000).toISOString();
    const { data: imports, error: importError } = await admin
      .from('ticket_imports')
      .insert([
        {
          user_id: userId,
          source: 'screenshot',
          storage_path: oldPath,
          status: 'discarded',
          resolved_at: eightDaysAgo,
          parsed: { venue: 'kept after the image goes' },
        },
        {
          user_id: userId,
          source: 'screenshot',
          storage_path: newPath,
          status: 'discarded',
          resolved_at: new Date().toISOString(),
        },
      ])
      .select('id, storage_path');
    if (importError) throw new Error(`ticket_imports: ${importError.message}`);
    const oldId = imports.find((r) => r.storage_path === oldPath).id;
    const newId = imports.find((r) => r.storage_path === newPath).id;

    const refused = await fetch(`${URL}/functions/v1/cleanup-imports`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    check(
      'cleanup-imports refuses a caller without the cron secret',
      refused.status === 401,
      `HTTP ${refused.status}`,
    );

    const cleanup = await callInternal('cleanup-imports');
    check('cleanup-imports runs', cleanup.status === 200, JSON.stringify(cleanup.body));
    check(
      'the 8-day-old ticket image is gone from storage',
      !(await exists('ticket-imports', oldPath)),
    );
    check('the image resolved today is still there', await exists('ticket-imports', newPath));
    const { data: after } = await admin
      .from('ticket_imports')
      .select('id, image_deleted_at, parsed')
      .in('id', [oldId, newId]);
    const oldRow = after.find((r) => r.id === oldId);
    const newRow = after.find((r) => r.id === newId);
    check(
      'the old import is marked image_deleted_at and keeps its parsed fields',
      !!oldRow.image_deleted_at && !!oldRow.parsed,
    );
    check('the recent import is untouched', newRow.image_deleted_at === null);

    // --- delete-account ------------------------------------------------------------------
    const { data: game } = await admin
      .from('games')
      .select('id')
      .eq('status', 'final')
      .limit(1)
      .single();
    const { data: attendance, error: attError } = await admin
      .from('attendances')
      .insert({ user_id: userId, game_id: game.id, status: 'attended', source: 'manual' })
      .select('id')
      .single();
    if (attError) throw new Error(`attendance: ${attError.message}`);
    // Nested one folder down, the way the app stores photos: a flat listing would miss it.
    const photoPath = `${userId}/${attendance.id}/${randomUUID()}.png`;
    const { error: photoUpload } = await admin.storage
      .from('attendance-photos')
      .upload(photoPath, PNG, { contentType: 'image/png' });
    if (photoUpload) throw new Error(`photo upload: ${photoUpload.message}`);
    const { error: photoRow } = await admin.from('attendance_photos').insert({
      attendance_id: attendance.id,
      user_id: userId,
      storage_path: photoPath,
      kind: 'photo',
      visibility: 'private',
    });
    if (photoRow) throw new Error(`attendance_photos: ${photoRow.message}`);

    const anonCall = await fetch(`${URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ANON}` },
    });
    check(
      'delete-account refuses a caller who is not signed in',
      anonCall.status === 401,
      `HTTP ${anonCall.status}`,
    );

    const userClient = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data: session, error: signInError } = await userClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) throw new Error(`sign in: ${signInError.message}`);
    const del = await fetch(`${URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.session.access_token}`, apikey: ANON },
    });
    const delBody = await del.json().catch(() => null);
    check(
      'delete-account succeeds for the signed-in user',
      del.status === 200 && delBody?.ok === true,
      JSON.stringify(delBody),
    );

    const { data: gone } = await admin.auth.admin.getUserById(userId);
    deleted = !gone?.user;
    check('the auth user no longer exists', deleted);
    for (const table of ['profiles', 'attendances', 'ticket_imports', 'attendance_photos']) {
      const column = table === 'profiles' ? 'id' : 'user_id';
      const { data: rows } = await admin.from(table).select(column).eq(column, userId);
      check(`no ${table} rows remain`, (rows ?? []).length === 0, `${(rows ?? []).length} left`);
    }
    check(
      'the remaining ticket image is gone from storage',
      !(await exists('ticket-imports', newPath)),
    );
    check(
      'the nested attendance photo is gone from storage',
      !(await exists('attendance-photos', photoPath)),
    );
  } finally {
    if (!deleted) {
      // Leave nothing behind when a check fails midway.
      for (const bucket of ['ticket-imports', 'attendance-photos']) {
        const { data: top } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
        for (const entry of top ?? []) {
          if (entry.id === null) {
            const { data: inner } = await admin.storage
              .from(bucket)
              .list(`${userId}/${entry.name}`);
            await admin.storage
              .from(bucket)
              .remove((inner ?? []).map((o) => `${userId}/${entry.name}/${o.name}`));
          } else {
            await admin.storage.from(bucket).remove([`${userId}/${entry.name}`]);
          }
        }
      }
      await admin.auth.admin.deleteUser(userId);
      console.log('throwaway user removed by the cleanup path');
    }
  }

  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
