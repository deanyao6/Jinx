import React from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/Card';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import {
  actorName,
  feedEventCopy,
  feedEventDetail,
  REACTION_EMOJI,
  relativeTime,
  type FeedEvent,
  type ReactionEmoji,
} from '../copy';

type Props = {
  event: FeedEvent;
  onOpen: () => void;
  onOpenActor: () => void;
  onReact: (emoji: ReactionEmoji) => void;
};

export function FeedEventCard({ event, onOpen, onOpenActor, onReact }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const name = actorName(event);
  const detail = feedEventDetail(event);
  return (
    <Card style={{ paddingBottom: theme.spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, @${event.actor_handle}`}
        onPress={onOpenActor}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <PersonAvatar
          userId={event.actor_user_id}
          name={event.actor_display_name}
          handle={event.actor_handle}
          path={event.actor_avatar_path}
          size={32}
        />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" color="muted" numberOfLines={1}>
            @{event.actor_handle} · {relativeTime(event.created_at)}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => ({ marginTop: theme.spacing.sm, opacity: pressed ? 0.6 : 1 })}
      >
        <Text variant="body">{feedEventCopy(event)}</Text>
        {detail ? (
          <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
            {detail}
          </Text>
        ) : null}
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing.sm }}>
        {REACTION_EMOJI.map((emoji) => {
          const count = event.reactions[emoji] ?? 0;
          const mine = event.my_reaction === emoji;
          return (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`React ${emoji}${count ? `, ${count}` : ''}`}
              accessibilityState={{ selected: mine }}
              onPress={() => onReact(emoji)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingVertical: 4,
                paddingHorizontal: 9,
                borderRadius: theme.radius.pill,
                borderWidth: 1,
                borderColor: mine ? c.ink : c.line,
                backgroundColor: mine ? c.tint : 'transparent',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text variant="sub">{emoji}</Text>
              {count > 0 ? (
                <Text
                  variant="caption"
                  color={mine ? 'ink' : 'muted'}
                  style={{ fontWeight: '600' }}
                >
                  {count}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
