/**
 * Push registration and local reminders (SPEC.md Section 10, M10 plumbing).
 * The OS permission prompt is never shown at launch: `registerPush` only asks when `request` is
 * true (settings screen, or after the first check-in).
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useAuthStore } from '@/features/auth/store';
import { supabase } from '@/lib/supabase';
import { ownedHref } from '@/features/navigation/tabs';
import { notificationRoute } from './queries';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PushStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getPushStatus(): Promise<PushStatus> {
  if (!Device.isDevice) return 'unsupported';
  const perm = await Notifications.getPermissionsAsync();
  if (perm.granted) return 'granted';
  return perm.canAskAgain ? 'undetermined' : 'denied';
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

/**
 * Registers the Expo push token for this device. With `request: false` it does nothing unless the
 * user already granted permission. Returns the resulting permission status.
 */
export async function registerPush(
  userId: string,
  opts: { request: boolean },
): Promise<PushStatus> {
  let status = await getPushStatus();
  if (status === 'unsupported') return status;
  if (status !== 'granted' && opts.request) {
    const perm = await Notifications.requestPermissionsAsync();
    status = perm.granted ? 'granted' : perm.canAskAgain ? 'undetermined' : 'denied';
  }
  if (status !== 'granted') return status;
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    const { error } = await supabase
      .from('device_tokens')
      .upsert(
        { user_id: userId, token: token.data, platform: Platform.OS },
        { onConflict: 'user_id,token' },
      );
    if (error) throw error;
  } catch (e) {
    console.warn('push registration failed', e);
  }
  return status;
}

/**
 * Registers the device once per session when permission is already granted, and routes taps on
 * notifications. Mount once in a screen that lives for the session.
 */
export function useNotificationRuntime(): void {
  const userId = useAuthStore((s) => s.userId);
  const router = useRouter();
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || registeredFor.current === userId) return;
    registeredFor.current = userId;
    void registerPush(userId, { request: false });
  }, [userId]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const content = response.notification.request.content;
      const data = (content.data ?? {}) as Record<string, unknown>;
      const kind = typeof data.kind === 'string' ? data.kind : 'unknown';
      const route = notificationRoute({ kind, data });
      // Onto the stack of the tab that owns it, with that tab's root under it (tabs.ts).
      if (route) router.push(ownedHref(route) as Href);
    });
    return () => sub.remove();
  }, [router]);
}

const PLEDGE_REMINDER_KEY = 'pledge_reminder';

/** "Pick a side before it locks." fired shortly after the user leaves the pledge screen unpledged. */
export async function schedulePledgeReminder(gameId: string, lockAtMs: number): Promise<void> {
  await cancelPledgeReminder(gameId);
  const seconds = Math.max(20, Math.min(120, Math.floor((lockAtMs - Date.now()) / 1000 / 3)));
  if (lockAtMs - Date.now() < 30_000) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `${PLEDGE_REMINDER_KEY}:${gameId}`,
      content: {
        title: 'Pick a side before it locks',
        body: 'Your pledge is still open. Choose a team before the lock.',
        data: { kind: 'game_day', game_id: gameId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
    });
  } catch (e) {
    console.warn('could not schedule pledge reminder', e);
  }
}

export async function cancelPledgeReminder(gameId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`${PLEDGE_REMINDER_KEY}:${gameId}`);
  } catch {
    // Nothing scheduled.
  }
}
