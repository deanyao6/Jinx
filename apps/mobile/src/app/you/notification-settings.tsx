import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, Switch, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/features/auth/store';
import { isKindEnabled, KIND_LABELS, NOTIFICATION_KINDS } from '@/features/notifications/kinds';
import { getPushStatus, registerPush, type PushStatus } from '@/features/notifications/push';
import { useNotificationPrefs, useSetNotificationPref } from '@/features/notifications/queries';
import { useTheme } from '@/theme/ThemeProvider';

export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const c = theme.colors;
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

  const onToggle = async (kind: (typeof NOTIFICATION_KINDS)[number], enabled: boolean) => {
    setPref.mutate({ kind, enabled });
    // First time the user turns something on is the moment to ask the OS (never at launch).
    if (enabled && push === 'undetermined') await enablePush();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Notification settings' }} />
      <Card label="Push notifications">
        {push == null ? <Loading /> : null}
        {push === 'granted' ? (
          <Text variant="sub">On for this device.</Text>
        ) : push === 'undetermined' ? (
          <>
            <Text variant="sub" style={{ marginBottom: theme.spacing.sm }}>
              Turn on notifications to get pledge results and game-day reminders on this device.
            </Text>
            <Button
              title="Turn on notifications"
              small
              onPress={enablePush}
              loading={busy}
              style={{ alignSelf: 'flex-start' }}
            />
          </>
        ) : push === 'denied' ? (
          <>
            <Text variant="sub" style={{ marginBottom: theme.spacing.sm }}>
              Notifications are off for this app in iOS Settings.
            </Text>
            <Button
              title="Open Settings"
              variant="secondary"
              small
              onPress={() => void Linking.openSettings()}
              style={{ alignSelf: 'flex-start' }}
            />
          </>
        ) : push === 'unsupported' ? (
          <Text variant="sub" color="muted">
            Push notifications need a physical device.
          </Text>
        ) : null}
      </Card>

      <Card label="What to send">
        {prefs.isPending ? <Loading /> : null}
        {prefs.isError ? (
          <ErrorNotice
            error={prefs.error}
            message="Could not load your settings."
            onRetry={prefs.refetch}
          />
        ) : null}
        {setPref.error ? <Notice tone="error">{errorMessage(setPref.error)}</Notice> : null}
        {prefs.data
          ? NOTIFICATION_KINDS.map((kind, i) => {
              const on = isKindEnabled(prefs.data, kind);
              return (
                <View
                  key={kind}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 10,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: c.line,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{KIND_LABELS[kind].title}</Text>
                    <Text variant="caption" color="muted">
                      {KIND_LABELS[kind].body}
                    </Text>
                  </View>
                  <Switch
                    value={on}
                    onValueChange={(v) => void onToggle(kind, v)}
                    accessibilityLabel={KIND_LABELS[kind].title}
                    trackColor={{ true: c.ink, false: c.line }}
                    thumbColor={c.card}
                  />
                </View>
              );
            })
          : null}
      </Card>
      <Text variant="caption" color="muted">
        Turning a kind off stops both the push and the entry in your notifications list.
      </Text>
    </Screen>
  );
}
