import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorNotice } from '@/components/ErrorNotice';
import { IconTile } from '@/components/IconTile';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { ToggleRow } from '@/features/account/ui/ToggleRow';
import { useAuthStore } from '@/features/auth/store';
import {
  isKindEnabled,
  KIND_LABELS,
  NOTIFICATION_KINDS,
  type NotificationKind,
} from '@/features/notifications/kinds';
import { getPushStatus, registerPush, type PushStatus } from '@/features/notifications/push';
import { useNotificationPrefs, useSetNotificationPref } from '@/features/notifications/queries';
import { useTheme } from '@/theme/ThemeProvider';

type Group = 'games' | 'passport' | 'friends' | 'tickets';

const GROUPS: { key: Group; title: string }[] = [
  { key: 'games', title: 'Games and pledges' },
  { key: 'passport', title: 'Your passport' },
  { key: 'friends', title: 'Friends' },
  { key: 'tickets', title: 'Tickets and email' },
];

/** Every kind names its group, so a kind added to `NOTIFICATION_KINDS` cannot be left out. */
const GROUP_OF: Record<NotificationKind, Group> = {
  game_day: 'games',
  pledge_result: 'games',
  pledge_void: 'games',
  goal_completed: 'passport',
  new_stamp: 'passport',
  milestone: 'passport',
  wrapped_ready: 'passport',
  tagged: 'friends',
  person_linked: 'friends',
  new_follower: 'friends',
  follow_request: 'friends',
  import_review: 'tickets',
  email_verified: 'tickets',
  inbound_rejected: 'tickets',
};

export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const userId = useAuthStore((s) => s.userId);
  const prefs = useNotificationPrefs();
  const setPref = useSetNotificationPref();
  const [push, setPush] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getPushStatus()
      .then((s) => {
        if (alive) setPush(s);
      })
      .catch(() => {
        if (alive) setPush('unsupported');
      });
    return () => {
      alive = false;
    };
  }, []);

  const enablePush = async () => {
    if (!userId) return;
    setBusy(true);
    const s = await registerPush(userId, { request: true });
    setPush(s);
    setBusy(false);
  };

  const onToggle = async (kind: NotificationKind, enabled: boolean) => {
    setPref.mutate({ kind, enabled });
    // First time the user turns something on is the moment to ask the OS (never at launch).
    if (enabled && push === 'undetermined') await enablePush();
  };

  const loaded = prefs.data;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Notification settings' }} />
      <Card tone="accent">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconTile icon="i-bell" solid={push === 'granted'} />
          <View style={{ flex: 1 }}>
            <Text variant="kicker" color="accent">
              Push notifications
            </Text>
            {push == null ? (
              <Text variant="sub" color="muted">
                Checking this device
              </Text>
            ) : push === 'granted' ? (
              <Text variant="bodyStrong">On for this device.</Text>
            ) : push === 'undetermined' ? (
              <Text variant="sub">
                Turn on notifications to get pledge results and game-day reminders on this device.
              </Text>
            ) : push === 'denied' ? (
              <Text variant="sub">Notifications are off for this app in iOS Settings.</Text>
            ) : (
              <Text variant="sub" color="muted">
                Push notifications need a physical device.
              </Text>
            )}
          </View>
        </View>
        {push === 'undetermined' ? (
          <Button
            title="Turn on notifications"
            onPress={enablePush}
            loading={busy}
            style={{ marginTop: theme.spacing.md }}
          />
        ) : push === 'denied' ? (
          <Button
            title="Open Settings"
            variant="secondary"
            onPress={() => void Linking.openSettings()}
            style={{ marginTop: theme.spacing.md }}
          />
        ) : null}
      </Card>

      {prefs.isPending ? <Loading /> : null}
      {prefs.isError ? (
        <ErrorNotice
          error={prefs.error}
          message="Could not load your settings."
          onRetry={prefs.refetch}
        />
      ) : null}
      {setPref.error ? <Notice tone="error">{errorMessage(setPref.error)}</Notice> : null}
      {loaded
        ? GROUPS.map((group) => (
            <React.Fragment key={group.key}>
              <SectionHeader title={group.title} />
              <Card>
                {NOTIFICATION_KINDS.filter((kind) => GROUP_OF[kind] === group.key).map((kind) => (
                  <ToggleRow
                    key={kind}
                    title={KIND_LABELS[kind].title}
                    body={KIND_LABELS[kind].body}
                    value={isKindEnabled(loaded, kind)}
                    onValueChange={(v) => void onToggle(kind, v)}
                  />
                ))}
              </Card>
            </React.Fragment>
          ))
        : null}
      <Text variant="caption" color="muted" style={{ marginTop: theme.spacing.xs }}>
        Turning a kind off stops both the push and the entry in your notifications list.
      </Text>
    </Screen>
  );
}
