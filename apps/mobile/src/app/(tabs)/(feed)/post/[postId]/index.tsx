import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useComments, usePost } from '@/features/feed/queries';
import { CommentLine } from '@/features/feed/ui/CommentLine';
import { PostCard } from '@/features/feed/ui/PostCard';
import { usePostActions } from '@/features/feed/ui/usePostActions';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * One post (social brief 02): the card in full, the latest comments, and the way into the
 * thread. Push notifications for kudos and comments open here. Muting someone hides them from
 * the feed, not from this page.
 */
export default function PostRoute() {
  const theme = useTheme();
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const post = usePost(postId);
  const comments = useComments(postId);
  const actions = usePostActions();

  if (post.isPending) return <Loading />;
  if (post.isError) {
    return (
      <Screen>
        <ErrorNotice error={post.error} onRetry={post.refetch} />
      </Screen>
    );
  }
  const p = post.data;
  if (!p) {
    return (
      <Screen>
        <EmptyState
          icon="i-news"
          title="This post is gone"
          body="It was deleted, or it is not shared with you."
          actionTitle="Back to the feed"
          onAction={() => router.replace('/feed')}
        />
      </Screen>
    );
  }
  const game = p.game;
  const latest = (comments.data ?? []).slice(-3);
  return (
    <Screen>
      <PostCard
        post={p}
        meId={actions.meId}
        full
        onOpenAuthor={() => actions.openAuthor(p)}
        onKudos={() => actions.toggleKudos(p)}
        onComments={() => actions.comments(p)}
        onMore={() => actions.more(p, () => router.back())}
      />
      {game ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <Button
            title={p.kind === 'reaction' ? 'Relive the game' : 'Open the game'}
            variant="secondary"
            onPress={() => router.push((p.kind === 'reaction' ? `/relive/${game.id}` : `/games/${game.id}`) as Href)}
          />
        </View>
      ) : null}
      <SectionHeader
        title={p.commentCount === 1 ? '1 comment' : `${p.commentCount} comments`}
        action={p.commentCount > latest.length ? 'See all' : undefined}
        onAction={() => actions.comments(p)}
      />
      {latest.length ? (
        <Card style={{ gap: 14 }}>
          {latest.map((c) => (
            <CommentLine key={c.id} postId={p.id} comment={c} />
          ))}
        </Card>
      ) : null}
      <View style={{ marginTop: theme.spacing.md }}>
        <Button title="Add a comment" onPress={() => actions.comments(p)} />
      </View>
    </Screen>
  );
}
