import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useAuthStore } from '@/features/auth/store';
import { authorName } from '@/features/feed/copy';
import { friendlySocialError } from '@/features/feed/errors';
import { useDeletePost, useToggleKudos } from '@/features/feed/queries';
import type { Post } from '@/features/feed/types';
import { env } from '@/lib/env';
import { useModerationMenu } from './useModerationMenu';

/** Everything a post card's taps do, the same on the feed, the post page and a profile. */
export function usePostActions() {
  const router = useRouter();
  const meId = useAuthStore((s) => s.userId);
  const kudos = useToggleKudos();
  const remove = useDeletePost();
  const menu = useModerationMenu();

  const open = useCallback((post: Post) => router.push(`/post/${post.id}` as Href), [router]);
  const openAuthor = useCallback(
    (post: Post) => {
      if (env.demo) return;
      router.push(`/u/${post.author.handle}` as Href);
    },
    [router],
  );
  const comments = useCallback((post: Post) => router.push(`/post/${post.id}/comments` as Href), [router]);
  const toggleKudos = useCallback(
    (post: Post) =>
      kudos.mutate(post, {
        onError: (e) => {
          const msg = friendlySocialError(e);
          if (msg) Alert.alert('Not now', msg);
        },
      }),
    [kudos],
  );

  const more = useCallback(
    (post: Post, onDeleted?: () => void) => {
      if (post.author.id === meId) {
        const buttons: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [];
        if (post.kind === 'game') {
          buttons.push({
            text: 'Edit post',
            onPress: () => {
              // A game post's composer is keyed by the attendance, which the card does not
              // carry; the game page has it and opens the composer from there.
              if (post.game) router.push(`/games/${post.game.id}` as Href);
            },
          });
        }
        buttons.push({
          text: 'Delete post',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Delete this post?', 'Kudos and comments go with it. Your game stays on your passport.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => remove.mutate(post.id, { onSuccess: onDeleted }),
              },
            ]),
        });
        buttons.push({ text: 'Cancel', style: 'cancel' });
        Alert.alert('Your post', undefined, buttons);
        return;
      }
      menu({ type: post.kind === 'reaction' ? 'reaction' : 'post', id: post.kind === 'reaction' ? (post.reactions[0]?.id ?? post.id) : post.id, userId: post.author.id, name: authorName(post) });
    },
    [meId, menu, remove, router],
  );

  return { meId, open, openAuthor, comments, toggleKudos, more };
}
