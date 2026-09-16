/**
 * parse-ticket: called by the app after uploading a screenshot or PDF to the private
 * `ticket-imports` bucket and creating a `ticket_imports` row (status pending).
 * Body: { import_id: string }. Auth: the user's JWT.
 */
import { createClient } from '@supabase/supabase-js';

import { asDb } from '../_shared/core/index.ts';
import { json } from '../_shared/db.ts';
import {
  anthropicClient,
  bytesToBase64,
  extractTickets,
  loadMatchContext,
  matchTicket,
  mediaTypeFor,
  recordMatch,
  type TicketInput,
} from '../_shared/ticket.ts';

interface ImportRow {
  id: string;
  user_id: string;
  source: 'screenshot' | 'email';
  storage_path: string | null;
  raw_text: string | null;
  status: string;
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('authorization') ?? '';

  // Identify the caller with their own JWT.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  let body: { import_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid body' }, 400);
  }
  if (!body.import_id) return json({ error: 'import_id required' }, 400);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const db = asDb(admin);
  const { data: impData, error: impErr } = await admin
    .from('ticket_imports')
    .select('*')
    .eq('id', body.import_id)
    .eq('user_id', userId)
    .single();
  if (impErr || !impData) return json({ error: 'import not found' }, 404);
  const imp = impData as ImportRow;

  try {
    let input: TicketInput;
    if (imp.storage_path) {
      const { data: file, error: dlErr } = await admin.storage
        .from('ticket-imports')
        .download(imp.storage_path);
      if (dlErr || !file) throw new Error(`download failed: ${dlErr?.message ?? 'no data'}`);
      const media = mediaTypeFor(imp.storage_path, file.type);
      if (!media) throw new Error('unsupported file type');
      const base64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
      input =
        media === 'application/pdf'
          ? { kind: 'pdf', base64 }
          : { kind: 'image', mediaType: media, base64 };
    } else if (imp.raw_text) {
      input = { kind: 'text', text: imp.raw_text };
    } else {
      throw new Error('import has no content');
    }

    const tickets = await extractTickets(anthropicClient(), input);
    if (tickets.length === 0) {
      await admin
        .from('ticket_imports')
        .update({ status: 'failed', error: 'No ticket found in this file', parsed: null })
        .eq('id', imp.id);
      return json({ import_id: imp.id, status: 'failed', tickets: 0 });
    }

    const ctx = await loadMatchContext(db);
    const results: { import_id: string; status: string }[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i]!;
      let importId = imp.id;
      if (i > 0) {
        // Additional games in one document get their own import rows sharing the same file.
        const { data: extra, error: extraErr } = await admin
          .from('ticket_imports')
          .insert({
            user_id: userId,
            source: imp.source,
            storage_path: imp.storage_path,
            raw_text: imp.raw_text,
            status: 'parsed',
          })
          .select('id')
          .single();
        if (extraErr || !extra) throw new Error(extraErr?.message ?? 'insert failed');
        importId = (extra as { id: string }).id;
      }
      const result = await matchTicket(db, ticket, ctx);
      await recordMatch(db, importId, ticket, result);
      results.push({ import_id: importId, status: result.decision });
    }
    return json({ import_id: imp.id, tickets: tickets.length, results });
  } catch (err) {
    console.error('parse-ticket failed', err);
    await admin
      .from('ticket_imports')
      .update({ status: 'failed', error: String(err).slice(0, 500) })
      .eq('id', imp.id);
    return json({ error: 'parse failed', detail: String(err) }, 500);
  }
});
