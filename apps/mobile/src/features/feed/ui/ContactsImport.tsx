import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, Linking, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { IconTile } from '@/components/IconTile';
import { Notice } from '@/components/Notice';
import { PersonAvatar } from '@/components/PersonAvatar';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/features/auth/store';
import { friendlySocialError } from '@/features/feed/errors';
import { matchContacts, markContactsPrompted, phoneDeps, readContacts, type ContactsResult } from '@/features/feed/contacts';
import { shareAppLink } from '@/features/people/invite';
import { useFollow } from '@/features/social/queries';
import { FollowButton } from '@/features/social/ui/FollowButton';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Find people you know (social brief 02, section 5). The value comes first, on screen, before
 * the system permission prompt; then matches with "Follow all" and a follow per row; then the
 * rest of the address book as invite rows. Skippable, and offered again under Friends.
 */
export function ContactsImport({ onDone, doneTitle = 'Continue' }: { onDone?: () => void; doneTitle?: string }) {
  const theme = useTheme();
  const userId = useAuthStore((s) => s.userId);
  const [denied, setDenied] = useState(false);
  const run = useMutation({
    mutationFn: async (): Promise<ContactsResult | null> => {
      const read = await readContacts();
      if (userId) void markContactsPrompted(userId);
      if (read.status === 'denied') {
        setDenied(true);
        return null;
      }
      return matchContacts(read.contacts, phoneDeps);
    },
  });

  const skip = () => {
    if (userId) void markContactsPrompted(userId);
    onDone?.();
  };

  if (!run.data) {
    return (
      <View style={{ gap: theme.spacing.md }}>
        <Card tone="accent" style={{ gap: 12 }}>
          <IconTile icon="i-users" solid />
          <Text variant="h2">Find people you know</Text>
          <Text variant="sub" color="muted">
            Jinx is better with friends: your record with the people you go with, rivalries, and a
            feed worth opening. We check your contacts against Jinx on your phone, send only
            scrambled codes, and keep nothing from your address book.
          </Text>
        </Card>
        {denied ? (
          <Notice>
            Contacts are off for Jinx. You can turn them on in Settings, or find people by handle
            instead.
          </Notice>
        ) : null}
        {run.error ? (
          <Notice tone="error">{friendlySocialError(run.error) ?? 'That did not work. Try again in a moment.'}</Notice>
        ) : null}
        {denied ? (
          <Button title="Open Settings" onPress={() => void Linking.openSettings()} />
        ) : (
          <Button title="Allow contacts" loading={run.isPending} onPress={() => run.mutate()} />
        )}
        {onDone ? <Button title="Not now" variant="ghost" onPress={skip} /> : null}
      </View>
    );
  }

  return <Results result={run.data} onDone={onDone} doneTitle={doneTitle} />;
}

function Results({ result, onDone, doneTitle }: { result: ContactsResult; onDone?: () => void; doneTitle: string }) {
  const theme = useTheme();
  const follow = useFollow();
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const toFollow = result.matches.filter((m) => m.followStatus === null && !followed.has(m.userId));

  const followAll = async () => {
    const done = new Set(followed);
    for (const m of toFollow) {
      try {
        await follow.mutateAsync({ userId: m.userId });
        done.add(m.userId);
      } catch (e) {
        Alert.alert('Stopped for now', friendlySocialError(e) ?? 'Some follows did not go through. Try again.');
        break;
      }
    }
    setFollowed(done);
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionHeader
        title={result.matches.length === 1 ? '1 friend on Jinx' : `${result.matches.length} friends on Jinx`}
      />
      {result.matches.length ? (
        <Card style={{ gap: 14 }}>
          {result.matches.map((m) => (
            <View key={m.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <PersonAvatar userId={m.userId} name={m.displayName} handle={m.handle} path={m.avatarPath} size={40} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {m.contactName}
                </Text>
                <Text variant="caption" color="muted" numberOfLines={1}>
                  @{m.handle}
                </Text>
              </View>
              <FollowButton
                userId={m.userId}
                name={m.displayName || m.handle}
                status={followed.has(m.userId) ? (m.isPrivate ? 'requested' : 'active') : m.followStatus}
                isPrivate={m.isPrivate}
                small
              />
            </View>
          ))}
          {toFollow.length > 1 ? (
            <Button title={`Follow all ${toFollow.length}`} loading={follow.isPending} onPress={() => void followAll()} />
          ) : null}
        </Card>
      ) : (
        <Card>
          <Text variant="sub" color="muted">
            None of your contacts are on Jinx yet. Invite a few below.
          </Text>
        </Card>
      )}
      {onDone ? <Button title={doneTitle} onPress={onDone} /> : null}
      {result.invites.length ? (
        <>
          <SectionHeader title="Invite" />
          <Card style={{ gap: 12 }}>
            {result.invites.slice(0, 50).map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <PersonAvatar userId={c.id} name={c.name} size={32} />
                <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
                  {c.name}
                </Text>
                <Button title="Invite" variant="secondary" small onPress={() => void shareAppLink()} />
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </View>
  );
}
