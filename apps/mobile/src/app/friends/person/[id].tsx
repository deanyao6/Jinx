import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { GameRow } from '@/components/GameRow';
import { Loading } from '@/components/Loading';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Notice, errorMessage } from '@/components/Notice';
import { Screen } from '@/components/Screen';
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
import { gamesLabel, recordText, recordTone } from '@/features/social/copy';
import { Avatar } from '@/features/social/ui/Avatar';
import { useTheme } from '@/theme/ThemeProvider';

export default function PersonScreen() {
  const theme = useTheme();
  const c = theme.colors;
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
        <Notice>This person is no longer on your list.</Notice>
      </Screen>
    );
  }

  const tone = recordTone(person.wins, person.losses);
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

  return (
    <Screen>
      <Stack.Screen options={{ title: person.display_name }} />
      {error ? <Notice tone="error">{errorMessage(error)}</Notice> : null}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={person.display_name} size={48} />
          <View style={{ flex: 1 }}>
            <Text variant="h2">{person.display_name}</Text>
            <Text variant="caption" color="muted">
              {linked && person.linked_handle
                ? `@${person.linked_handle} · linked`
                : 'Not on the app yet'}
            </Text>
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: theme.spacing.lg,
            marginTop: theme.spacing.md,
          }}
        >
          <View>
            <Text
              variant="display"
              color={tone === 'good' ? 'green' : tone === 'bad' ? 'red' : 'ink'}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {recordText(person.wins, person.losses, person.ties)}
            </Text>
            <Text variant="caption" color="muted">
              Your record together
            </Text>
          </View>
          <View style={{ paddingBottom: 4 }}>
            <Text variant="stat" style={{ fontVariant: ['tabular-nums'] }}>
              {person.games}
            </Text>
            <Text variant="caption" color="muted">
              {person.games === 1 ? 'game' : 'games'}
            </Text>
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
            marginTop: theme.spacing.md,
          }}
        >
          {linked && person.linked_handle ? (
            <Button
              title="See their passport"
              variant="secondary"
              small
              onPress={() => router.push(`/u/${person.linked_handle}`)}
            />
          ) : (
            <Button
              title="Invite to link"
              small
              loading={invite.isPending}
              onPress={() => void onInvite()}
            />
          )}
          {person.games ? (
            <Button
              title="Share"
              variant="ghost"
              small
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
          <Button
            title="Rename"
            variant="ghost"
            small
            onPress={() => {
              setName(person.display_name);
              setEditing((v) => !v);
            }}
          />
          <Button
            title="Remove"
            variant="danger"
            small
            loading={remove.isPending}
            onPress={onDelete}
          />
        </View>
        {!linked ? (
          <Text variant="caption" color="muted" style={{ marginTop: theme.spacing.sm }}>
            Inviting shares a link. When they open it in the app, their account takes this person’s
            place and they can add your shared games to their own passport.
          </Text>
        ) : null}
        {editing ? (
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.sm,
              alignItems: 'flex-start',
              marginTop: theme.spacing.md,
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
            <Button title="Save" small loading={rename.isPending} onPress={() => void onRename()} />
          </View>
        ) : null}
      </Card>

      <Card label={`Games together${games.data ? ` · ${games.data.length}` : ''}`}>
        {games.isPending ? <Loading /> : null}
        {games.isError ? <ErrorNotice error={games.error} onRetry={games.refetch} /> : null}
        {games.data && games.data.length === 0 ? (
          <Text variant="sub" color="muted">
            No games together yet. Tag {person.display_name} when you log one.
          </Text>
        ) : null}
        {(games.data ?? []).map((g, i) => (
          <GameRow
            key={g.game_id}
            first={i === 0}
            game={{
              id: g.game_id,
              scheduled_start: g.scheduled_start,
              status: g.home_score != null && g.away_score != null ? 'final' : 'scheduled',
              awayName: g.away_team_name,
              homeName: g.home_team_name,
              venueName: g.venue_name,
              home_score: g.home_score,
              away_score: g.away_score,
            }}
            badge={
              g.result === 'win'
                ? 'Win'
                : g.result === 'loss'
                  ? 'Loss'
                  : g.result === 'tie'
                    ? 'Tie'
                    : null
            }
            onPress={() => router.push(`/games/${g.game_id}`)}
          />
        ))}
      </Card>
      {person.games ? (
        <Text variant="caption" color="muted">
          {gamesLabel(person.games)} with a side counted. Neutral games are listed but not scored.
        </Text>
      ) : null}
      <View style={{ height: 1, backgroundColor: c.line, opacity: 0 }} />
    </Screen>
  );
}
