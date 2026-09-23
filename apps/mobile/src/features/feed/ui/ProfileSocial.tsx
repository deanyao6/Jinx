import { compatibilitySentence, type CompatibilityDriver } from '@jinx/core';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { SectionHeader } from '@/components/SectionHeader';
import { StatTile } from '@/components/StatTile';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/features/auth/store';
import { useCompatibility, useMutedIds, useProfilePosts, useRecordWith, useSetMuted } from '@/features/feed/queries';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { Pill, PostCard } from './PostCard';
import { usePostActions } from './usePostActions';

/** Superfan badge and their one-line note (social brief 02, section 4). */
export function CreatorLine({ userId }: { userId: string }) {
  const theme = useTheme();
  const me = useAuthStore((s) => s.userId);
  const info = useQuery({
    queryKey: ['feed', 'creator', me, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_creator, creator_note')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!me,
    staleTime: 10 * 60_000,
  });
  if (!info.data?.is_creator) return null;
  return (
    <View style={{ alignItems: 'center', gap: 6, marginTop: -theme.spacing.sm, marginBottom: theme.spacing.lg }}>
      <Pill label="Superfan" tone="gold" />
      {info.data.creator_note ? (
        <Text variant="sub" color="muted" align="center">
          {info.data.creator_note}
        </Text>
      ) : null}
    </View>
  );
}

/** "With you" and compatibility. Compatibility is for mutual follows only; the record is mine. */
export function Together({ userId, isMutual }: { userId: string; isMutual: boolean }) {
  const theme = useTheme();
  const compat = useCompatibility(userId, isMutual);
  const record = useRecordWith(userId);
  const games = record.data?.games ?? 0;
  const c = compat.data;
  if (!games && !c) return null;
  const recordLabel =
    record.data && games
      ? record.data.ties
        ? `${record.data.wins}–${record.data.losses}–${record.data.ties}`
        : `${record.data.wins}–${record.data.losses}`
      : null;
  return (
    <>
      <SectionHeader title="You two" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {c ? <StatTile label="Compatibility" value={`${c.score}`} accent /> : null}
        {recordLabel ? (
          <StatTile label="With you" value={recordLabel} note={games === 1 ? '1 game together' : `${games} games together`} />
        ) : null}
      </View>
      {c ? (
        <Text variant="sub" color="muted" style={{ marginTop: theme.spacing.sm }}>
          {compatibilitySentence(c.driver as CompatibilityDriver, c.driver_count)}
        </Text>
      ) : null}
    </>
  );
}

/** Their latest posts, as the viewer is allowed to see them. */
export function ProfilePosts({ userId }: { userId: string }) {
  const posts = useProfilePosts(userId);
  const actions = usePostActions();
  if (!posts.data?.length) return null;
  return (
    <>
      <SectionHeader title="Posts" />
      <View style={{ gap: 12 }}>
        {posts.data.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            meId={actions.meId}
            onOpen={() => actions.open(p)}
            onOpenAuthor={() => undefined}
            onKudos={() => actions.toggleKudos(p)}
            onComments={() => actions.comments(p)}
            onMore={() => actions.more(p)}
          />
        ))}
      </View>
    </>
  );
}

/** Mute: their posts and comments leave my feed and threads; they are not told. */
export function MuteButton({ userId }: { userId: string }) {
  const muted = useMutedIds();
  const set = useSetMuted();
  const isMuted = muted.data?.has(userId) ?? false;
  return (
    <Button
      title={isMuted ? 'Unmute' : 'Mute'}
      variant="ghost"
      small
      loading={set.isPending}
      onPress={() => set.mutate({ userId, muted: !isMuted })}
    />
  );
}
