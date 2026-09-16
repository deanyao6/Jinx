/**
 * inbound-email: receives forwarded ticket confirmations from the Cloudflare Email Worker
 * (infra/cloudflare-email-worker). Body: { token, from, subject, text, html, attachments: [{ filename, content_type, base64 }] }.
 * Auth: header x-inbound-secret must equal INBOUND_EMAIL_SECRET.
 *
 * Sender allow-list (SPEC 7.3): the account's sign-in email is always allowed; other addresses are
 * verified by sending any email from that address to the forwarding address (a pending
 * user_emails row becomes verified). Unknown senders are dropped and the user is told at most once a day.
 */
import { createClient } from '@supabase/supabase-js';

import { asDb } from '../_shared/core/index.ts';
import { json } from '../_shared/db.ts';
import {
  anthropicClient,
  extractTickets,
  loadMatchContext,
  matchTicket,
  recordMatch,
  type TicketInput,
} from '../_shared/ticket.ts';

interface InboundBody {
  token: string;
  from: string;
  subject?: string;
  text?: string;
  html?: string;
  attachments?: { filename: string; content_type: string; base64: string }[];
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n');
}

export function extractAddress(from: string): string {
  const m = /<([^>]+)>/.exec(from);
  return (m ? m[1]! : from).trim().toLowerCase();
}

export function tokenFromAddress(addr: string): string | null {
  const m = /^u-([a-z0-9]{10,})@/i.exec(addr.trim());
  return m ? m[1]!.toLowerCase() : null;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('INBOUND_EMAIL_SECRET');
  if (!secret || req.headers.get('x-inbound-secret') !== secret)
    return json({ error: 'unauthorized' }, 401);
  let body: InboundBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid body' }, 400);
  }
  const token = (body.token ?? '').toLowerCase();
  if (!token) return json({ error: 'token required' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const db = asDb(admin);

  const { data: addr } = await admin
    .from('inbound_addresses')
    .select('user_id')
    .eq('token', token)
    .maybeSingle();
  if (!addr) return json({ ok: true, dropped: 'unknown_token' });
  const userId = (addr as { user_id: string }).user_id;
  const sender = extractAddress(body.from ?? '');

  // Sender allow-list.
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const signInEmail = authUser?.user?.email?.toLowerCase() ?? null;
  let allowed = sender !== '' && sender === signInEmail;
  if (!allowed) {
    const { data: rows } = await admin
      .from('user_emails')
      .select('email, verified')
      .eq('user_id', userId);
    const match = ((rows ?? []) as { email: string; verified: boolean }[]).find(
      (r) => r.email.toLowerCase() === sender,
    );
    if (match?.verified) allowed = true;
    else if (match) {
      await admin
        .from('user_emails')
        .update({ verified: true })
        .eq('user_id', userId)
        .eq('email', match.email);
      await admin.from('notifications').insert({
        user_id: userId,
        kind: 'email_verified',
        title: 'Email verified',
        body: `${sender} can now forward tickets to your address.`,
        data: { email: sender },
      });
      allowed = true;
    }
  }
  if (!allowed) {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await admin
      .from('inbound_rejections')
      .insert({ user_id: userId, notified_on: today });
    if (!error) {
      await admin.from('notifications').insert({
        user_id: userId,
        kind: 'inbound_rejected',
        title: 'Mail from an unknown address',
        body: "We got mail from an address you haven't added. Add it in Settings to import tickets from it.",
        data: { sender },
      });
    }
    return json({ ok: true, dropped: 'sender_not_allowed' });
  }

  // Content: text first, then HTML, then PDF attachments.
  const text = (body.text ?? '').trim() || htmlToText(body.html ?? '');
  const inputs: TicketInput[] = [];
  if (text) inputs.push({ kind: 'text', text: `Subject: ${body.subject ?? ''}\n\n${text}` });
  for (const a of body.attachments ?? []) {
    if (a.content_type === 'application/pdf' && a.base64)
      inputs.push({ kind: 'pdf', base64: a.base64 });
  }
  if (inputs.length === 0) return json({ ok: true, dropped: 'no_content' });

  const client = anthropicClient();
  const ctx = await loadMatchContext(db);
  const created: { import_id: string; status: string; auto_confirmed: boolean }[] = [];
  for (const input of inputs) {
    const tickets = await extractTickets(client, input);
    if (tickets.length === 0) continue;
    for (const ticket of tickets) {
      const { data: row, error } = await admin
        .from('ticket_imports')
        .insert({
          user_id: userId,
          source: 'email',
          raw_text: input.kind === 'text' ? input.text.slice(0, 20_000) : `[pdf attachment]`,
          status: 'parsed',
        })
        .select('id')
        .single();
      if (error || !row) throw new Error(error?.message ?? 'insert failed');
      const importId = (row as { id: string }).id;
      const result = await matchTicket(db, ticket, ctx);
      await recordMatch(db, importId, ticket, result);
      let auto = false;
      if (result.decision === 'matched' && result.candidates[0]) {
        // A confirmation the user forwarded on purpose: log it directly (SPEC 7.3).
        const { error: confirmErr } = await admin.rpc('confirm_ticket_import_for', {
          p_user: userId,
          p_import_id: importId,
          p_game_id: result.candidates[0].game.id,
        });
        auto = !confirmErr;
        if (confirmErr) console.error('auto confirm failed', confirmErr.message);
      }
      created.push({ import_id: importId, status: result.decision, auto_confirmed: auto });
    }
    if (created.length > 0 && input.kind === 'text') break; // PDFs are a fallback when the text yielded nothing
  }
  if (created.length === 0) {
    await admin.from('ticket_imports').insert({
      user_id: userId,
      source: 'email',
      raw_text: text.slice(0, 20_000),
      status: 'failed',
      error: 'No ticket found in this email',
    });
  }
  const needsReview = created.filter((c) => c.status === 'needs_review').length;
  if (needsReview > 0) {
    await admin.from('notifications').insert({
      user_id: userId,
      kind: 'import_review',
      title: 'Ticket needs a look',
      body: `${needsReview} forwarded ticket${needsReview > 1 ? 's' : ''} need${needsReview > 1 ? '' : 's'} you to pick the game.`,
      data: {},
    });
  }
  return json({ ok: true, imports: created });
});
