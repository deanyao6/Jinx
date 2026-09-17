import { formatWinRate } from '@jinx/core';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { GameRow } from '@/components/GameRow';
import { Loading } from '@/components/Loading';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Notice, errorMessage } from '@/components/Notice';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { shareInvite } from '@/features/people/invite';
import {
  useCompanionGames,
  useCompanionRecords,
  useCreatePersonInvite,
  useDeletePerson,
  useRenamePerson,
} from '@/features/people/queries';
import { openShare } from '@/features/share/navigate';
import { gamesLabel, recordText } from '@/features/social/copy';
import { formatScore } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

export default function PersonScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const records = useCompanionRecords();
  const games = useCompanionGames(id);
  const invite = useCreatePersonInvite();
  const rename = useRenamePerson();
  const remove = useDeletePerson();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const person = useMemo(
    () => records.data?.find((p) => p.person_id === id) ?? null,
    [records.data, id],
  );

  if (records.isPending) return <Loading label="Loading" />;
  if (records.isError) {
    return (
      <Screen>
        <ErrorNotice error={records.error} onRetry={records.refetch} />
      </Screen>
    );
  }
  if (!person) {
    return (
      <Screen>
        <EmptyState
          icon="i-users"
          title="No longer on your list"
          body="This person is no longer on your list."
        />
      </Screen>
    );
  }

  const linked = !!person.linked_user_id;
  const error = invite.error ?? rename.error ?? remove.error;

  const onInvite = async () => {
    try {
      const token = await invite.mutateAsync({ personId: person.person_id });
      await shareInvite(person.display_name, token);
    } catch {
      // surfaced through invite.error
    }
  };

  const onRename = async () => {
    const next = name.trim();
    if (!next || next === person.display_name) {
      setEditing(false);
      return;
    }
    await rename.mutateAsync({ personId: person.person_id, displayName: next });
    setEditing(false);
  };

  const onDelete = () => {
    Alert.alert(
      `Remove ${person.display_name}?`,
      linked
        ? 'They stay on the app, but their tags come off your games and this record goes away.'
        : 'Their tags come off your games and this record goes away.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            remove.mutate({ personId: person.person_id }, { onSuccess: () => router.back() }),
        },
      ],
    );
  };

  const winRate = formatWinRate({ wins: person.wins, losses: person.losses, ties: person.ties });

  return (
    <Screen>
      <Stack.Screen options={{ title: person.display_name }} />
      {error ? <Notice tone="error">{errorMessage(error)}</Notice> : null}

      <View style={{ alignItems: 'center', marginBottom: theme.spacing.lg }}>
        <PersonAvatar
          userId={person.linked_user_id ?? person.person_id}
          name={person.display_name}
          handle={person.linked_handle}
          path={person.linked_avatar_path}
          size={72}
          ring
        />
        <Text
          variant="kicker"
          color="accent"
          style={{ marginTop: theme.spacing.md, textTransform: 'none' }}
        >
          {linked && person.linked_handle
            ? `@${person.linked_handle} · linked`
            : 'Not on the app yet'}
        </Text>
        <Text
          variant="h1"
          align="center"
          numberOfLines={2}
          adjustsFontSizeToFit
          accessibilityRole="header"
          style={{ marginTop: 4 }}
        >
          {person.display_name}
        </Text>
      </View>

      <Card tone="accent" label="Your record together">
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.lg }}>
          <Text
            variant="display"
            color="accent"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ flex: 1, fontVariant: ['tabular-nums'] }}
          >
            {recordText(person.wins, person.losses, person.ties)}
          </Text>
          <View style={{ alignItems: 'flex-end', paddingBottom: 4 }}>
            <Text variant="kicker" color="muted">
              Win rate
            </Text>
            <Text variant="stat" style={{ fontVariant: ['tabular-nums'] }}>
              {winRate}
            </Text>
          </View>
        </View>
        <Text variant="sub" color="muted" style={{ marginTop: theme.spacing.sm }}>
          <Text variant="sub" weight={750} style={{ fontVariant: ['tabular-nums'] }}>
            {person.games}
          </Text>{' '}
          {person.games === 1 ? 'game' : 'games'} together
        </Text>
      </Card>

      <Card>
        {linked && person.linked_handle ? (
          <Row
            icon="i-passport"
            title="See their passport"
            accessibilityLabel="See their passport"
            chevron
            onPress={() => router.push(`/u/${person.linked_handle}`)}
          />
        ) : (
          <Row
            icon="i-users"
            title="Invite to link"
            subtitle="Inviting shares a link. When they open it in the app, their account takes this person’s place and they can add your shared games to their own passport."
            accessibilityLabel="Invite to link"
            right={invite.isPending ? <ActivityIndicator color={theme.accent.text} /> : null}
            chevron={!invite.isPending}
            onPress={invite.isPending ? undefined : () => void onInvite()}
          />
        )}
        {person.games ? (
          <Row
            icon="i-share"
            title="Share"
            subtitle="Your record together, as a card"
            accessibilityLabel="Share"
            chevron
            onPress={() =>
              openShare(router, {
                kind: 'companion',
                name: person.display_name,
                wins: person.wins,
                losses: person.losses,
                ties: person.ties,
                games: person.games,
              })
            }
          />
        ) : null}
        <Row
          icon="i-user"
          title="Rename"
          accessibilityLabel="Rename"
          onPress={() => {
            setName(person.display_name);
            setEditing((v) => !v);
          }}
        />
        {editing ? (
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.sm,
              alignItems: 'flex-start',
              marginTop: theme.spacing.sm,
              marginBottom: theme.spacing.sm,
            }}
          >
            <TextField
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              maxLength={40}
              autoFocus
              containerStyle={{ flex: 1, marginBottom: 0 }}
              returnKeyType="done"
              onSubmitEditing={() => void onRename()}
              accessibilityLabel="Name"
            />
            <Button
              title="Save"
              small
              loading={rename.isPending}
              onPress={() => void onRename()}
              style={{ minHeight: 51 }}
            />
          </View>
        ) : null}
      </Card>

      <SectionHeader title={`Games together${games.data ? ` · ${games.data.length}` : ''}`} />
      <Card>
        {games.isPending ? <Loading /> : null}
        {games.isError ? <ErrorNotice error={games.error} onRetry={games.refetch} /> : null}
        {games.data && games.data.length === 0 ? (
          <Text variant="sub" color="muted">
            No games together yet. Tag {person.display_name} when you log one.
          </Text>
        ) : null}
        {(games.data ?? []).map((g, i) => {
          const status = g.home_score != null && g.away_score != null ? 'final' : 'scheduled';
          const result =
            g.result === 'win'
              ? 'Win'
              : g.result === 'loss'
                ? 'Loss'
                : g.result === 'tie'
                  ? 'Tie'
                  : null;
          return (
            <GameRow
              key={g.game_id}
              first={i === 0}
              game={{
                id: g.game_id,
                scheduled_start: g.scheduled_start,
                status,
                awayName: g.away_team_name,
                homeName: g.home_team_name,
                venueName: g.venue_name,
                home_score: g.home_score,
                away_score: g.away_score,
              }}
              right={
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    variant="stat"
                    color={status === 'final' ? 'ink' : 'muted'}
                    style={{ fontSize: 20, lineHeight: 22, fontVariant: ['tabular-nums'] }}
                  >
                    {formatScore({
                      homeScore: g.home_score,
                      awayScore: g.away_score,
                      status,
                    })}
                  </Text>
                  {result ? (
                    <Text
                      variant="label"
                      color={g.result === 'win' ? 'green' : g.result === 'loss' ? 'red' : 'muted'}
                    >
                      {result}
                    </Text>
                  ) : null}
                </View>
              }
              onPress={() => router.push(`/games/${g.game_id}`)}
            />
          );
        })}
      </Card>
      {person.games ? (
        <Text variant="caption" color="muted">
          {gamesLabel(person.games)} with a side counted. Neutral games are listed but not scored.
        </Text>
      ) : null}

      <Button
        title="Remove"
        variant="danger"
        small
        loading={remove.isPending}
        onPress={onDelete}
        style={{ alignSelf: 'center', marginTop: theme.spacing.xl }}
      />
    </Screen>
  );
}
