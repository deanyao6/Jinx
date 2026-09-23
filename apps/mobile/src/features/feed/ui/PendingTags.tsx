import React from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Text } from '@/components/Text';
import { gameDate } from '@/features/feed/copy';
import { useAnswerTag, usePendingTags, type PendingTag } from '@/features/feed/queries';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * "Dean says you were at Mets at Phillies, Sep 20. Add it?" (social brief 02, section 7).
 *
 * Only a tag of a real, linked user is ever pending; a placeholder like "Dad" never asks
 * anyone. Accept puts the game on this fan's passport; "Not me" removes the tag without telling
 * the tagger who said no.
 */
export function tagQuestion(tag: Pick<PendingTag, 'taggerName' | 'awayName' | 'homeName' | 'scheduledStart'>): string {
  const date = gameDate({ scheduled_start: tag.scheduledStart, venue_tz: null });
  return `${tag.taggerName} says you were at ${tag.awayName} at ${tag.homeName}, ${date}. Add it?`;
}

export function PendingTags() {
  const tags = usePendingTags();
  if (!tags.data?.length) return null;
  return (
    <View style={{ gap: 12, marginBottom: 12 }}>
      {tags.data.map((tag) => (
        <TagCard key={`${tag.attendanceId}-${tag.personId}`} tag={tag} />
      ))}
    </View>
  );
}

function TagCard({ tag }: { tag: PendingTag }) {
  const theme = useTheme();
  const answer = useAnswerTag();
  const reply = (accept: boolean) =>
    answer.mutate(
      { tag, accept },
      {
        onError: () => Alert.alert('That did not work', 'Check your connection and try again.'),
      },
    );
  return (
    <Card tone="accent">
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <PersonAvatar userId={tag.taggerId} name={tag.taggerName} handle={tag.taggerHandle} path={tag.taggerAvatarPath} size={36} />
        <Text variant="body" style={{ flex: 1 }}>
          {tagQuestion(tag)}
        </Text>
      </View>
      {tag.alreadyLogged ? (
        <Text variant="caption" color="muted" style={{ marginTop: 6 }}>
          It is already on your passport; adding confirms you were there together.
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
        <Button title="Add it" small loading={answer.isPending && answer.variables?.accept} onPress={() => reply(true)} />
        <Button
          title="Not me"
          small
          variant="ghost"
          loading={answer.isPending && answer.variables?.accept === false}
          onPress={() => reply(false)}
        />
      </View>
    </Card>
  );
}
