import { useRouter, type Href } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { draftCountdown } from '@/features/feed/copy';
import {
  useDeletePost,
  useMyPostStates,
  usePostSettings,
  usePublishDraft,
  type MyPostState,
} from '@/features/feed/queries';
import { useTheme } from '@/theme/ThemeProvider';

/** Re-renders once a minute, for a countdown. */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/**
 * My post about one game, on the game page (social brief 02, section 1): a draft in its edit
 * window ("Posts in 12 min", edit, post now, don't post), a game waiting for "Post this", or
 * the post itself.
 */
export function YourPost({ gameId }: { gameId: string }) {
  const theme = useTheme();
  const states = useMyPostStates();
  const settings = usePostSettings();
  const state = states.data?.get(gameId);
  if (!state) return null;
  return (
    <Card>
      <Text variant="kicker" color="muted">
        Your post
      </Text>
      <View style={{ height: theme.spacing.sm }} />
      <PostStateBody state={state} autoPost={settings.data?.autoPost ?? true} />
    </Card>
  );
}

export function PostStateBody({ state, autoPost }: { state: MyPostState; autoPost: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const now = useMinuteClock();
  const publish = usePublishDraft();
  const remove = useDeletePost();
  const compose = () => router.push(`/games/compose/${state.attendanceId}` as Href);

  if (state.state === 'draft' && state.postId) {
    const postId = state.postId;
    return (
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="bodyStrong">{draftCountdown(state.publishAt, now)}</Text>
        <Text variant="sub" color="muted">
          Auto-post is on. Add a caption or photos first, or let it go up as it is.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <Button title="Edit" small onPress={compose} />
          <Button title="Post now" small variant="secondary" loading={publish.isPending} onPress={() => publish.mutate(postId)} />
          <Button
            title="Don't post"
            small
            variant="ghost"
            loading={remove.isPending}
            onPress={() =>
              Alert.alert('Skip posting this game?', 'It stays on your passport. You can still post it later.', [
                { text: 'Cancel', style: 'cancel' },
                { text: "Don't post", style: 'destructive', onPress: () => remove.mutate(postId) },
              ])
            }
          />
        </View>
      </View>
    );
  }
  if (state.state === 'posted' && state.postId) {
    const postId = state.postId;
    return (
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
        <Text variant="body" style={{ flex: 1 }}>
          Posted to your feed.
        </Text>
        <Button title="Open" small variant="secondary" onPress={() => router.push(`/post/${postId}` as Href)} />
        <Button title="Edit" small variant="ghost" onPress={compose} />
      </View>
    );
  }
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="sub" color="muted">
        {autoPost
          ? 'Not posted. Games logged well after they end wait here instead of auto-posting.'
          : 'Auto-post is off, so this game waits for you.'}
      </Text>
      <Button title="Post this" small onPress={compose} style={{ alignSelf: 'flex-start' }} />
    </View>
  );
}

/** Drafts first, then games from the last week not posted yet, newest first; three at most. */
export function bannerItems(states: readonly MyPostState[], now: Date): MyPostState[] {
  const weekAgo = now.getTime() - 7 * 24 * 3600_000;
  return states
    .filter((s) => s.state === 'draft' || (s.state === 'unposted' && new Date(s.endedAt).getTime() > weekAgo))
    .sort((a, b) => (a.state === b.state ? b.endedAt.localeCompare(a.endedAt) : a.state === 'draft' ? -1 : 1))
    .slice(0, 3);
}

/**
 * The banner on the Games tab: drafts counting down, then games from the last week still
 * waiting for "Post this". Nothing when there is nothing to do.
 */
export function PostBanner() {
  const theme = useTheme();
  const router = useRouter();
  const states = useMyPostStates();
  const settings = usePostSettings();
  const now = useMinuteClock();
  const due = bannerItems([...(states.data?.values() ?? [])], now);
  if (!due.length) return null;
  return (
    <View style={{ gap: 10, marginBottom: 12 }}>
      {due.map((s) => (
        <Card key={s.attendanceId} tone={s.state === 'draft' ? 'accent' : 'plain'}>
          <Text
            variant="kicker"
            color="muted"
            onPress={() => router.push(`/games/${s.gameId}` as Href)}
            accessibilityRole="link"
          >
            {s.label}
          </Text>
          <View style={{ height: theme.spacing.sm }} />
          <PostStateBody state={s} autoPost={settings.data?.autoPost ?? true} />
        </Card>
      ))}
    </View>
  );
}
