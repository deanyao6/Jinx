import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckRow } from '@/components/CheckRow';
import { IconTile } from '@/components/IconTile';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import type { IconName } from '@/components/reference/icons';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/hooks';
import { useNavStore } from '@/features/nav/store';
import {
  useAcceptPersonInvite,
  useImportTaggedGames,
  useTaggedGamesForMe,
  type AcceptInviteResult,
} from '@/features/people/queries';
import { useProfile } from '@/features/profile/queries';
import { useProfileByIdName } from '@/features/social/ownerName';
import { formatGameDate } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

function reasonCopy(reason: string): { title: string; body: string } {
  switch (reason) {
    case 'own_invite':
      return {
        title: 'That’s your own invite',
        body: 'Share this link with the person you tagged. Opening it yourself does nothing.',
      };
    case 'already_linked':
      return {
        title: 'Already linked',
        body: 'This invite was accepted by someone else. Ask for a fresh link if that’s wrong.',
      };
    case 'blocked':
      return { title: 'Not available', body: 'This invite can’t be accepted.' };
    default:
      return {
        title: 'Invite not found',
        body: 'The link may have expired or been replaced. Ask them to share a new one.',
      };
  }
}

/** The top of the card: a tile, what happened, and one line about what it means. */
function InviteHeader({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <IconTile icon={icon} size={56} solid />
      <Text variant="h2" align="center" style={{ marginTop: 4 }}>
        {title}
      </Text>
      <Text variant="sub" color="muted" align="center">
        {body}
      </Text>
    </View>
  );
}

export default function InviteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { status } = useAuth();
  const profile = useProfile();
  const setPendingRoute = useNavStore((s) => s.setPendingRoute);
  const accept = useAcceptPersonInvite();
  const [result, setResult] = useState<AcceptInviteResult | null>(null);
  const started = useRef(false);

  const signedIn = status === 'signedIn';
  const onboarded = signedIn && !!profile.data?.onboarded_at;

  // Signed out (or mid-onboarding): park the route and come back after sign-in.
  useEffect(() => {
    if (status === 'loading' || !token) return;
    if (!signedIn) {
      setPendingRoute(`/invite/${token}`);
      router.replace('/(auth)/welcome');
    } else if (profile.data && !onboarded) {
      setPendingRoute(`/invite/${token}`);
      router.replace('/(onboarding)');
    }
  }, [status, signedIn, onboarded, profile.data, token, router, setPendingRoute]);

  useEffect(() => {
    if (!onboarded || !token || started.current) return;
    started.current = true;
    accept.mutate({ token }, { onSuccess: setResult });
  }, [onboarded, token, accept]);

  if (!onboarded || accept.isPending || (!result && !accept.isError)) {
    return <Loading label="Checking invite" />;
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Invite' }} />
      {accept.isError ? <Notice tone="error">{errorMessage(accept.error)}</Notice> : null}
      {result && !result.ok ? (
        <Card tone="accent">
          <InviteHeader
            icon={result.reason === 'blocked' ? 'i-lock' : 'i-users'}
            title={reasonCopy(result.reason).title}
            body={reasonCopy(result.reason).body}
          />
          <Button
            title="Back to Friends"
            onPress={() => router.replace('/(tabs)/profile')}
            style={{ marginTop: theme.spacing.lg }}
          />
        </Card>
      ) : null}
      {result && result.ok ? (
        <Accepted owner={result.owner_user_id} taggedGames={result.tagged_games} />
      ) : null}
    </Screen>
  );
}

function Accepted({ owner, taggedGames }: { owner: string; taggedGames: number }) {
  const theme = useTheme();
  const router = useRouter();
  const ownerName = useProfileByIdName(owner);
  const tagged = useTaggedGamesForMe(owner);
  const importGames = useImportTaggedGames();
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const importable = useMemo(
    () => (tagged.data ?? []).filter((g) => !g.already_logged),
    [tagged.data],
  );
  const selected = chosen ?? new Set(importable.map((g) => g.game_id));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
  };

  const who = ownerName ?? 'They';

  return (
    <>
      <Card tone="accent">
        <InviteHeader
          icon="i-check-c"
          title="You’re linked"
          body={`${who} can now tag you at games and see your record together.${
            done == null && taggedGames === 0
              ? ` ${ownerName ? `${ownerName} hasn’t` : 'They haven’t'} tagged you at any games yet.`
              : ''
          }`}
        />
        {done == null && taggedGames === 0 ? (
          <Button
            title="Back to Friends"
            onPress={() => router.replace('/(tabs)/profile')}
            style={{ marginTop: theme.spacing.lg }}
          />
        ) : null}
      </Card>
      {done != null ? (
        <Card>
          <Text variant="h2">{done === 1 ? '1 game added' : `${done} games added`}</Text>
          <Text variant="sub" color="muted" style={{ marginTop: 4 }}>
            They’re on your passport as unverified. Open any of them to add a side or seat.
          </Text>
          <Button
            title="See your games"
            onPress={() => router.replace('/(tabs)/games?segment=history')}
            style={{ marginTop: theme.spacing.lg }}
          />
        </Card>
      ) : taggedGames === 0 ? null : (
        <Card>
          <Text variant="h2">
            {who} tagged you at {taggedGames === 1 ? '1 game' : `${taggedGames} games`}. Add them to
            your passport?
          </Text>
          <Text
            variant="sub"
            color="muted"
            style={{ marginTop: 4, marginBottom: theme.spacing.sm }}
          >
            Only the games you tick are added, as unverified attendances. Nothing is added without
            your say.
          </Text>
          {tagged.isPending ? <Loading /> : null}
          {tagged.isError ? <Notice tone="error">{errorMessage(tagged.error)}</Notice> : null}
          {importGames.isError ? (
            <Notice tone="error">{errorMessage(importGames.error)}</Notice>
          ) : null}
          {(tagged.data ?? []).map((g, i) => (
            <CheckRow
              key={g.game_id}
              first={i === 0}
              title={`${g.away_team_name} at ${g.home_team_name}`}
              subtitle={[formatGameDate(g.scheduled_start, { withYear: true }), g.venue_name]
                .filter(Boolean)
                .join(' · ')}
              checked={g.already_logged || selected.has(g.game_id)}
              disabled={g.already_logged}
              trailing={g.already_logged ? 'Already logged' : null}
              onToggle={() => toggle(g.game_id)}
            />
          ))}
          <View
            style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}
          >
            <Button
              title={
                selected.size === 0
                  ? 'Pick games to add'
                  : `Add ${selected.size === 1 ? '1 game' : `${selected.size} games`}`
              }
              disabled={selected.size === 0}
              loading={importGames.isPending}
              onPress={() =>
                importGames.mutate({ owner, gameIds: [...selected] }, { onSuccess: setDone })
              }
              style={{ flex: 1 }}
            />
            <Button
              title="Not now"
              variant="ghost"
              onPress={() => router.replace('/(tabs)/profile')}
            />
          </View>
        </Card>
      )}
    </>
  );
}
