import { Stack } from 'expo-router';
import React from 'react';
import { Switch, View } from 'react-native';

import { Card } from '@/components/Card';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useProfile, useUpdateProfile, type ProfilePatch } from '@/features/profile/queries';
import { useTheme } from '@/theme/ThemeProvider';

type Key = 'is_private' | 'share_seats' | 'show_on_overlap';

const SETTINGS: { key: Key; title: string; body: string }[] = [
  {
    key: 'is_private',
    title: 'Private account',
    body: 'People must ask to follow you. Non-followers see only your name and handle, not your games, records, or feed events.',
  },
  {
    key: 'share_seats',
    title: 'Share seat details',
    body: 'Show your section, row, and seat on game detail to people you follow who follow you back. Off by default.',
  },
  {
    key: 'show_on_overlap',
    title: 'Show on overlap',
    body: 'Let mutual follows see “before you connected” cards for games you were both at.',
  },
];

/** Privacy toggles on the profile row (SPEC.md 8.9, 9). */
export default function PrivacyScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const profile = useProfile();
  const update = useUpdateProfile();
  const p = profile.data;

  const onToggle = (key: Key, value: boolean) => {
    const patch: ProfilePatch = { [key]: value };
    update.mutate(patch);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Privacy' }} />
      {profile.isPending ? <Loading /> : null}
      {profile.isError ? <ErrorNotice error={profile.error} onRetry={profile.refetch} /> : null}
      {update.isError ? <ErrorNotice error={update.error} /> : null}
      {p ? (
        <Card>
          {SETTINGS.map((s, i) => (
            <View
              key={s.key}
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
                <Text variant="bodyStrong">{s.title}</Text>
                <Text variant="caption" color="muted">
                  {s.body}
                </Text>
              </View>
              <Switch
                value={!!p[s.key]}
                onValueChange={(v) => onToggle(s.key, v)}
                accessibilityLabel={s.title}
                trackColor={{ true: c.ink, false: c.line }}
                thumbColor={c.card}
              />
            </View>
          ))}
        </Card>
      ) : null}
      <Text variant="caption" color="muted">
        Your location is used only when you tap Check in and is never stored. Ticket images are
        private and deleted after processing. Blocks hide you and the other person from each other
        everywhere.
      </Text>
    </Screen>
  );
}
