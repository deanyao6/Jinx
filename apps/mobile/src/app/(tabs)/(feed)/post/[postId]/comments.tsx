import { hasProfanity } from '@jinx/core';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { COMMENT_MAX, postHeadline } from '@/features/feed/copy';
import { friendlySocialError } from '@/features/feed/errors';
import { useAddComment, useComments, usePost } from '@/features/feed/queries';
import { CommentLine } from '@/features/feed/ui/CommentLine';
import { env } from '@/lib/env';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The thread on a post (social brief 02, section 3): flat, oldest first so the newest is last,
 * 500 characters. Words that might come across badly get a soft warning, not a silent block.
 * No DMs anywhere; report, mute and block live on every comment.
 */
export default function CommentsRoute() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const post = usePost(postId);
  const comments = useComments(postId);
  const add = useAddComment(postId);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const go = () =>
      add.mutate(text, {
        onSuccess: () => {
          setDraft('');
          setError(null);
        },
        onError: (e) => setError(friendlySocialError(e) ?? 'That did not post. Try again.'),
      });
    if (hasProfanity(text)) {
      Alert.alert('Post this?', 'It might come across badly. You can edit it, or post it as it is.', [
        { text: 'Edit', style: 'cancel' },
        { text: 'Post anyway', onPress: go },
      ]);
      return;
    }
    go();
  };

  if (comments.isPending) return <Loading />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.screen }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={comments.data ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: theme.spacing.lg, gap: 16 }}
        ListHeaderComponent={
          post.data ? (
            <Text variant="h2" style={{ marginBottom: 4 }}>
              {postHeadline(post.data)}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          comments.isError ? (
            <ErrorNotice error={comments.error} onRetry={comments.refetch} />
          ) : (
            <EmptyState icon="i-users" title="No comments yet" body="Say something nice. Or something true." />
          )
        }
        renderItem={({ item }) => <CommentLine postId={postId} comment={item} />}
      />
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.sm,
          paddingBottom: insets.bottom + theme.spacing.sm,
          backgroundColor: theme.colors.card,
          gap: 8,
        }}
      >
        <TextField
          value={draft}
          onChangeText={(t) => setDraft(t.slice(0, COMMENT_MAX))}
          placeholder="Add a comment"
          accessibilityLabel="Add a comment"
          multiline
          maxLength={COMMENT_MAX}
          error={error}
          hint={draft.length > COMMENT_MAX - 50 ? `${COMMENT_MAX - draft.length} characters left` : null}
          editable={!env.demo}
        />
        <Button title="Post comment" small loading={add.isPending} disabled={!draft.trim()} onPress={send} />
      </View>
    </KeyboardAvoidingView>
  );
}
