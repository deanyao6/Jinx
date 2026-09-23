import type { IconName } from '@/components/reference/icons';
import type { NotificationKind } from '@/features/notifications/kinds';

const KIND_ICONS: Record<NotificationKind, IconName> = {
  game_day: 'i-clock',
  pledge_result: 'i-target',
  pledge_void: 'i-flag',
  goal_completed: 'i-check-c',
  new_stamp: 'i-passport',
  milestone: 'i-trend',
  tagged: 'i-users',
  kudos: 'i-spark',
  comment: 'i-news',
  person_linked: 'i-users',
  new_follower: 'i-user',
  follow_request: 'i-user',
  import_review: 'i-ticket',
  wrapped_ready: 'i-spark',
  email_verified: 'i-verified',
  inbound_rejected: 'i-lock',
};

/** The icon for a notification's kind. The column is free text, so an unknown kind is a bell. */
export function notificationIcon(kind: string): IconName {
  return kind in KIND_ICONS ? KIND_ICONS[kind as NotificationKind] : 'i-bell';
}
