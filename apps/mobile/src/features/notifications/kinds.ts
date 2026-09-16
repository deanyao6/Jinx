/** Notification kinds (SPEC.md Section 10). Order here is the order on the settings screen. */
export const NOTIFICATION_KINDS = [
  'game_day',
  'pledge_result',
  'pledge_void',
  'goal_completed',
  'new_stamp',
  'milestone',
  'tagged',
  'person_linked',
  'new_follower',
  'follow_request',
  'import_review',
  'wrapped_ready',
  'email_verified',
  'inbound_rejected',
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const KIND_LABELS: Record<NotificationKind, { title: string; body: string }> = {
  game_day: {
    title: 'Game day',
    body: 'A morning reminder to check in for games you are going to.',
  },
  pledge_result: {
    title: 'Pledge results',
    body: 'How your pledge turned out once the game is final.',
  },
  pledge_void: {
    title: 'Pledge voids',
    body: 'When a pledge came in after the lock and did not count.',
  },
  goal_completed: { title: 'Goals completed', body: 'When you finish a goal.' },
  new_stamp: { title: 'New stamps', body: 'A new venue or milestone stamp on your passport.' },
  milestone: { title: 'Milestones', body: 'Round-number games, venues, and streaks.' },
  tagged: { title: 'Tagged at a game', body: 'Someone you follow tagged you at a game.' },
  person_linked: {
    title: 'Linked to you',
    body: 'A friend linked one of their companions to your account.',
  },
  new_follower: { title: 'New followers', body: 'Someone started following you.' },
  follow_request: { title: 'Follow requests', body: 'Requests to follow your private account.' },
  import_review: { title: 'Imports to review', body: 'A ticket needs you to pick the right game.' },
  wrapped_ready: { title: 'Wrapped ready', body: 'Your season wrap-up is ready to see.' },
  email_verified: { title: 'Sender verified', body: 'A forwarding email address was verified.' },
  inbound_rejected: {
    title: 'Rejected mail',
    body: 'We got mail from an address you have not added.',
  },
};

export type Prefs = Partial<Record<NotificationKind, boolean>>;

export function readPrefs(raw: unknown): Prefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Prefs = {};
  for (const k of NOTIFICATION_KINDS) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

/** Every kind defaults to on. */
export function isKindEnabled(prefs: Prefs, kind: NotificationKind): boolean {
  return prefs[kind] !== false;
}
