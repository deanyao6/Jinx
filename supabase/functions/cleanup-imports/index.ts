/**
 * cleanup-imports: deletes stored ticket images 7 days after the import was resolved
 * (SPEC.md 7.2.6). Parsed fields are kept. Runs daily from pg_cron.
 */
import { createClient } from '@supabase/supabase-js';

import { authorizeInternal, json } from '../_shared/db.ts';

const RETENTION_DAYS = Number(Deno.env.get('TICKET_IMAGE_RETENTION_DAYS') ?? '7');

Deno.serve(async (req) => {
  if (!authorizeInternal(req)) return json({ error: 'unauthorized' }, 401);
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  const { data, error } = await admin
    .from('ticket_imports')
    .select('id, storage_path')
    .not('storage_path', 'is', null)
    .is('image_deleted_at', null)
    .or(`resolved_at.lte.${cutoff},and(status.in.(failed,discarded),updated_at.lte.${cutoff})`)
    .limit(200);
  if (error) return json({ error: error.message }, 500);
  const rows = (data ?? []) as { id: string; storage_path: string }[];
  const paths = [...new Set(rows.map((r) => r.storage_path))];
  if (paths.length > 0) {
    const { error: rmErr } = await admin.storage.from('ticket-imports').remove(paths);
    if (rmErr) return json({ error: rmErr.message }, 500);
  }
  const now = new Date().toISOString();
  for (const r of rows)
    await admin.from('ticket_imports').update({ image_deleted_at: now }).eq('id', r.id);
  return json({ deleted: paths.length, imports: rows.length });
});
