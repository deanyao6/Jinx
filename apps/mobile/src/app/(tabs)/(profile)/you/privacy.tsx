import { Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Card } from '@/components/Card';
import { ErrorNotice } from '@/components/ErrorNotice';
import { IconTile } from '@/components/IconTile';
import { Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { ToggleRow } from '@/features/account/ui/ToggleRow';
import { useProfile, useUpdateProfile, type ProfilePatch } from '@/features/profile/queries';
import { useTheme } from '@/theme/ThemeProvider';

type Key = 'is_private' | 'share_seats' | 'show_on_overlap' | 'checkin_visible' | 'reaction_prompts';

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
  {
    key: 'checkin_visible',
    title: 'Show that I am checked in',
    body: 'Mutual friends at the same game see you in Also here: that you are there, and your section if you share seats. Never your location.',
  },
  {
    key: 'reaction_prompts',
    title: 'Reaction prompts',
    body: 'While you are checked in: one late in the game and up to two big moments, as notifications. Off means none, ever. You can still react on your own.',
  },
];

/** The profile's value for a switch. Check-in visibility is a word on the row, not a boolean. */
function valueOf(p: { is_private: boolean; share_seats: boolean; show_on_overlap: boolean; checkin_visibility: string; reaction_prompts: boolean }, key: Key): boolean {
  if (key === 'checkin_visible') return p.checkin_visibility !== 'off';
  return !!p[key];
}

/** Privacy toggles on the profile row (SPEC.md 8.9, 9). */
export default function PrivacyScreen() {
  const theme = useTheme();
  const profile = useProfile();
  const update = useUpdateProfile();
  const p = profile.data;

  const onToggle = (key: Key, value: boolean) => {
    const patch: ProfilePatch = key === 'checkin_visible' ? { checkin_visibility: value ? 'mutuals' : 'off' } : { [key]: value };
    update.mutate(patch);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Privacy' }} />
      {profile.isPending ? <Loading /> : null}
      {profile.isError ? <ErrorNotice error={profile.error} onRetry={profile.refetch} /> : null}
      {update.isError ? <ErrorNotice error={update.error} /> : null}
      {p ? (
        <>
          <SectionHeader title="Who sees what" />
          <Card>
            {SETTINGS.map((s) => (
              <ToggleRow
                key={s.key}
                title={s.title}
                body={s.body}
                value={valueOf(p, s.key)}
                onValueChange={(v) => onToggle(s.key, v)}
              />
            ))}
          </Card>
        </>
      ) : null}
      <SectionHeader title="Always private" />
      <Card tone="accent">
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md }}>
          <IconTile icon="i-lock" />
          <Text variant="sub" style={{ flex: 1 }}>
            Your location is used only when you tap Check in and is never stored. Ticket images are
            private and deleted after processing. Blocks hide you and the other person from each
            other everywhere.
          </Text>
        </View>
      </Card>
    </Screen>
  );
}
