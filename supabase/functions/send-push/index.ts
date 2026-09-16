/**
 * send-push: delivers unsent notifications through the Expo push service (SPEC.md 10).
 * Scheduled every 2 minutes by pg_cron while unsent notifications exist.
 */
import { authorizeInternal, json, serviceDb } from '../_shared/db.ts';

interface Pending {
  notification_id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  tokens: string[];
}

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

export function chunkMessages<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

Deno.serve(async (req) => {
  if (!authorizeInternal(req)) return json({ error: 'unauthorized' }, 401);
  const db = serviceDb();
  const { data, error } = await db.rpc('pending_pushes', { p_limit: 200 });
  if (error) return json({ error: error.message }, 500);
  const pending = (data ?? []) as Pending[];
  const messages: {
    to: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
    sound: 'default';
  }[] = [];
  const byToken = new Map<string, string>();
  for (const n of pending) {
    for (const token of n.tokens) {
      messages.push({
        to: token,
        title: n.title,
        body: n.body,
        data: { ...n.data, kind: n.kind, notification_id: n.notification_id },
        sound: 'default',
      });
      byToken.set(token, n.notification_id);
    }
  }
  const dead: string[] = [];
  let sent = 0;
  for (const batch of chunkMessages(messages)) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(Deno.env.get('EXPO_ACCESS_TOKEN')
          ? { authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` }
          : {}),
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      console.error('expo push failed', res.status, await res.text());
      continue;
    }
    const { data: tickets } = (await res.json()) as { data: ExpoTicket[] };
    tickets.forEach((t, i) => {
      if (t.status === 'ok') sent++;
      else if (t.details?.error === 'DeviceNotRegistered') dead.push(batch[i]!.to);
    });
  }
  if (dead.length > 0) await db.rpc('remove_device_tokens', { p_tokens: dead });
  const ids = pending.map((p) => p.notification_id);
  if (ids.length > 0) await db.rpc('mark_pushes_sent', { p_ids: ids });
  return json({
    notifications: ids.length,
    messages: messages.length,
    sent,
    removedTokens: dead.length,
  });
});
