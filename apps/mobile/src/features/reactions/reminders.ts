/**
 * The scheduled local notification 30 minutes before the start of any game the fan marked
 * Going (03, section 1, way 1). Scheduled on the device, works offline, needs no new permission
 * beyond notifications. A tap lands on the check-in screen (`game_day` routes there).
 */
import * as Notifications from 'expo-notifications';

export const CHECKIN_REMINDER_KEY = 'checkin_reminder';
export const REMINDER_LEAD_MS = 30 * 60_000;

export type ReminderGame = {
  id: string;
  scheduled_start: string;
  home: string | null;
  away: string | null;
  venue: string | null;
};

/** Which games get a reminder now: still ahead, within a week, and their reminder time not past. */
export function remindersWanted(games: readonly ReminderGame[], nowMs: number): ReminderGame[] {
  const week = 7 * 24 * 60 * 60_000;
  return games.filter((g) => {
    const start = Date.parse(g.scheduled_start);
    return Number.isFinite(start) && start - REMINDER_LEAD_MS > nowMs && start - nowMs <= week;
  });
}

export function reminderCopy(g: ReminderGame): { title: string; body: string } {
  const matchup = g.away && g.home ? `${g.away} at ${g.home}` : 'Your game';
  return {
    title: `${matchup} starts in 30 minutes`,
    body: g.venue ? `At ${g.venue}? Check in when you are inside.` : 'Check in when you are inside the stadium.',
  };
}

/** Reconciles the scheduled reminders with the games that want one. Never throws. */
export async function syncCheckInReminders(games: readonly ReminderGame[], nowMs = Date.now()): Promise<void> {
  try {
    const wanted = remindersWanted(games, nowMs);
    const wantedIds = new Set(wanted.map((g) => `${CHECKIN_REMINDER_KEY}:${g.id}`));
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const have = new Set<string>();
    for (const n of scheduled) {
      const id = n.identifier;
      if (!id.startsWith(`${CHECKIN_REMINDER_KEY}:`)) continue;
      if (wantedIds.has(id)) have.add(id);
      else await Notifications.cancelScheduledNotificationAsync(id);
    }
    for (const g of wanted) {
      const id = `${CHECKIN_REMINDER_KEY}:${g.id}`;
      if (have.has(id)) continue;
      const at = new Date(Date.parse(g.scheduled_start) - REMINDER_LEAD_MS);
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: { ...reminderCopy(g), data: { kind: 'game_day', game_id: g.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
      });
    }
  } catch (e) {
    console.warn('check-in reminders', e);
  }
}
