import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { Alert, Pressable, View } from 'react-native';

import { PersonAvatar } from '@/components/PersonAvatar';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/features/auth/store';
import { useDeleteComment, type Comment } from '@/features/feed/queries';
import { relativeTime } from '@/features/social/copy';
import { env } from '@/lib/env';
import { useModerationMenu } from './useModerationMenu';

/**
 * One comment in the flat thread. The overflow menu is report, mute and block for someone
 * else's; delete appears for your own and for any comment on your post.
 */
export function CommentLine({ postId, comment }: { postId: string; comment: Comment }) {
  const router = useRouter();
  const meId = useAuthStore((s) => s.userId);
  const remove = useDeleteComment(postId);
  const menu = useModerationMenu();
  const name = comment.displayName.trim() || comment.handle;
  const mine = comment.authorId === meId;

  const confirmDelete = () =>
    Alert.alert('Delete this comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(comment.id) },
    ]);

  const onMore = () => {
    if (mine) {
      confirmDelete();
      return;
    }
    menu(
      { type: 'comment', id: comment.id, userId: comment.authorId, name },
      comment.canDelete ? [{ title: 'Delete comment', destructive: true, onPress: confirmDelete }] : undefined,
    );
  };

  return (
    <View style={{ flexDirection: 'row', gap: 10, opacity: remove.isPending ? 0.4 : 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, @${comment.handle}`}
        onPress={() => {
          if (!env.demo) router.push(`/u/${comment.handle}` as Href);
        }}
      >
        <PersonAvatar userId={comment.authorId} name={comment.displayName} handle={comment.handle} path={comment.avatarPath} size={32} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text variant="caption" color="muted">
          <Text variant="caption" style={{ fontWeight: '700' }}>
            {name}
          </Text>
          {'  '}
          {relativeTime(comment.createdAt)}
        </Text>
        <Text variant="body">{comment.body}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mine ? 'Delete your comment' : `Report, mute or block ${name}`}
        hitSlop={8}
        onPress={onMore}
        style={({ pressed }) => ({ paddingHorizontal: 4, opacity: pressed ? 0.5 : 1 })}
      >
        <Text variant="bodyStrong" color="muted" style={{ letterSpacing: 2 }}>
          ···
        </Text>
      </Pressable>
    </View>
  );
}
