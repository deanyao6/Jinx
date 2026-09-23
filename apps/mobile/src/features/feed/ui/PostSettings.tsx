import React from 'react';
import { View } from 'react-native';

import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ErrorNotice } from '@/components/ErrorNotice';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { ToggleRow } from '@/features/account/ui/ToggleRow';
import { VISIBILITY_LABEL } from '@/features/feed/copy';
import { usePostSettings, useUpdatePostSettings, type SystemPostKind } from '@/features/feed/queries';
import type { Visibility } from '@/features/feed/types';
import { useTheme } from '@/theme/ThemeProvider';

const SYSTEM_KINDS: { key: SystemPostKind; title: string; body: string }[] = [
  { key: 'stamp', title: 'New stamps', body: 'The first time you see a game at a stadium.' },
  { key: 'milestone', title: 'Milestones', body: 'Your 10th, 25th, 50th and 100th game.' },
  { key: 'goal', title: 'Goals', body: 'When you finish one.' },
  { key: 'wrapped', title: 'Wrapped', body: 'When a season recap is ready.' },
];

/**
 * Every social mechanic has an off switch (social brief 02, sections 1 and 5): auto-post, the
 * default audience, each kind of automatic post, and whether contacts can find you.
 */
export function PostSettings() {
  const theme = useTheme();
  const settings = usePostSettings();
  const update = useUpdatePostSettings();
  const s = settings.data;
  if (!s) return settings.isError ? <ErrorNotice error={settings.error} onRetry={settings.refetch} /> : null;
  const kindOn = (k: SystemPostKind) => !s.mutedKinds.includes(k);
  const setKind = (k: SystemPostKind, on: boolean) =>
    update.mutate({ mutedKinds: on ? s.mutedKinds.filter((m) => m !== k) : [...s.mutedKinds, k] });

  return (
    <>
      {update.isError ? <ErrorNotice error={update.error} /> : null}
      <SectionHeader title="Posts" />
      <Card>
        <ToggleRow
          title="Auto-post games"
          body="A post goes up 30 minutes after a game you logged ends, with 15 minutes to edit it first. Off, and each game waits for you to post it."
          value={s.autoPost}
          onValueChange={(v) => update.mutate({ autoPost: v })}
        />
        <View style={{ paddingVertical: theme.spacing.sm, gap: theme.spacing.sm }}>
          <Text variant="bodyStrong">Who sees new posts</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {(['followers', 'public', 'private'] as Visibility[]).map((v) => (
              <Chip key={v} label={VISIBILITY_LABEL[v]} selected={s.visibility === v} onPress={() => update.mutate({ visibility: v })} />
            ))}
          </View>
        </View>
      </Card>
      <SectionHeader title="Automatic posts" />
      <Card>
        {SYSTEM_KINDS.map((k) => (
          <ToggleRow key={k.key} title={k.title} body={k.body} value={kindOn(k.key)} onValueChange={(v) => setKind(k.key, v)} />
        ))}
      </Card>
      <SectionHeader title="Contacts" />
      <Card>
        <ToggleRow
          title="Findable from contacts"
          body="People who have your email or number saved can find you when they check their contacts. Off, and only your handle finds you."
          value={s.discoverableByContacts}
          onValueChange={(v) => update.mutate({ discoverableByContacts: v })}
        />
      </Card>
    </>
  );
}
