import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Notice, errorMessage } from '@/components/Notice';
import { Row } from '@/components/Row';
import { Text } from '@/components/Text';
import { eggs } from '@/features/eggs/flags';
import { HandshakeRows } from '@/features/eggs/HandshakeRows';
import { useEggsLive } from '@/features/eggs/runtime';
import { useMyTagsAtGame, useRemoveMyTag } from '@/features/people/queries';
import { useTheme } from '@/theme/ThemeProvider';
import { useMutualsAtGame } from '../queries';

/**
 * Game-detail block owned by the Friends work: mutuals who were also at this game, and a
 * "Remove my tag" action when someone tagged a person row linked to me on their attendance.
 */
export function AlsoThere({ gameId }: { gameId: string }) {
  const router = useRouter();
  const mutuals = useMutualsAtGame(gameId);
  const tags = useMyTagsAtGame(gameId);
  const remove = useRemoveMyTag();
  // The secret handshake egg. Off, or in demo mode, the rows below are the ones this card has
  // always drawn and nothing about handshakes is asked of the server.
  const eggsLive = useEggsLive();
  const handshakes = eggs.secretHandshake && eggsLive;

  const list = mutuals.data ?? [];
  const myTags = tags.data ?? [];
  if (list.length === 0 && myTags.length === 0) return null;

  return (
    <Card label="Also there">
      {remove.error ? <Notice tone="error">{errorMessage(remove.error)}</Notice> : null}
      {handshakes ? <HandshakeRows gameId={gameId} mutuals={list} /> : null}
      {(handshakes ? [] : list).map((m, i) => (
        <Row
          key={m.user_id}
          first={i === 0}
          title={m.display_name?.trim() || `@${m.handle}`}
          subtitle={`@${m.handle}`}
          chevron
          onPress={() => router.push(`/u/${m.handle}`)}
        />
      ))}
      {myTags.map((t) => (
        <TagRow
          key={`${t.attendance_id}-${t.person_id}`}
          ownerName={t.owner_display_name?.trim() || `@${t.owner_handle}`}
          busy={remove.isPending && remove.variables?.attendanceId === t.attendance_id}
          onRemove={() =>
            Alert.alert(
              'Remove your tag?',
              'You come off their game. Their passport keeps the game.',
              [
                { text: 'Keep', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () =>
                    remove.mutate({ attendanceId: t.attendance_id, personId: t.person_id }),
                },
              ],
            )
          }
        />
      ))}
    </Card>
  );
}

function TagRow({
  ownerName,
  busy,
  onRemove,
}: {
  ownerName: string;
  busy: boolean;
  onRemove: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: theme.colors.line,
      }}
    >
      <Text variant="sub" style={{ flex: 1 }}>
        {ownerName} tagged you at this game.
      </Text>
      <Button title="Remove my tag" variant="ghost" small loading={busy} onPress={onRemove} />
    </View>
  );
}
