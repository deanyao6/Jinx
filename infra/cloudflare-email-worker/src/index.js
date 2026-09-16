// Cloudflare Email Worker: receives mail for *@in.<domain>, parses it, and forwards the
// pieces the app needs to the inbound-email Edge Function (SPEC.md 7.3).
// Setup: Cloudflare Email Routing -> catch-all on the "in" subdomain -> "Send to a Worker" -> this worker.
import PostalMime from 'postal-mime';

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

function toBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export default {
  async email(message, env) {
    const to = (message.to || '').toLowerCase();
    const m = /^u-([a-z0-9]{10,})@/.exec(to);
    if (!m) {
      message.setReject('No such address');
      return;
    }
    const raw = await new Response(message.raw).arrayBuffer();
    const parsed = await new PostalMime().parse(raw);
    const attachments = [];
    for (const a of parsed.attachments || []) {
      if (a.mimeType !== 'application/pdf') continue;
      const bytes =
        a.content instanceof ArrayBuffer
          ? new Uint8Array(a.content)
          : new Uint8Array(a.content || []);
      if (bytes.length === 0 || bytes.length > MAX_ATTACHMENT_BYTES) continue;
      attachments.push({
        filename: a.filename || 'ticket.pdf',
        content_type: 'application/pdf',
        base64: toBase64(bytes),
      });
    }
    const body = {
      token: m[1],
      from: message.from,
      subject: parsed.subject || '',
      text: parsed.text || '',
      html: parsed.html || '',
      attachments,
    };
    const res = await fetch(`${env.SUPABASE_FUNCTIONS_URL}/inbound-email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-inbound-secret': env.INBOUND_EMAIL_SECRET },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('inbound-email failed', res.status, await res.text());
    }
  },
};
