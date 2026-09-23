import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { Image, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckRow } from '@/components/CheckRow';
import { Chip } from '@/components/Chip';
import { ErrorNotice } from '@/components/ErrorNotice';
import { FormScreen } from '@/components/FormScreen';
import { Loading } from '@/components/Loading';
import { Notice } from '@/components/Notice';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useMyAttendanceForGame } from '@/features/attendances/queries';
import { draftCountdown, VISIBILITY_LABEL } from '@/features/feed/copy';
import { friendlySocialError } from '@/features/feed/errors';
import {
  MAX_POST_PHOTOS,
  useComposerSeed,
  usePostSettings,
  useSaveGamePost,
} from '@/features/feed/queries';
import type { Visibility } from '@/features/feed/types';
import { PostImage } from '@/features/feed/ui/PostImage';
import { pickMedia, type PickedMedia } from '@/features/relive/photos';
import { useTheme } from '@/theme/ThemeProvider';

const VISIBILITIES: Visibility[] = ['followers', 'public', 'private'];

/**
 * The game post composer (social brief 02, section 1), one screen: caption, photos, which of
 * this game's reactions to attach, who sees it, and who you were with. Opened from "Post this",
 * from a draft's Edit, and from a posted game's Edit.
 */
export default function ComposeRoute() {
  const { attendanceId } = useLocalSearchParams<{ attendanceId: string }>();
  const seed = useComposerSeed(attendanceId);
  const settings = usePostSettings();
  if (seed.isPending || settings.isPending) return <Loading />;
  if (seed.isError) {
    return (
      <FormScreen>
        <ErrorNotice error={seed.error} onRetry={seed.refetch} />
      </FormScreen>
    );
  }
  return (
    <Composer
      attendanceId={attendanceId}
      seed={seed.data}
      defaultVisibility={settings.data?.visibility ?? 'followers'}
    />
  );
}

type Seed = NonNullable<ReturnType<typeof useComposerSeed>['data']>;

function Composer({
  attendanceId,
  seed,
  defaultVisibility,
}: {
  attendanceId: string;
  seed: Seed;
  defaultVisibility: Visibility;
}) {
  const theme = useTheme();
  const router = useRouter();
  const save = useSaveGamePost();
  const attendance = useMyAttendanceForGame(seed.gameId);
  const post = seed.post;
  const isDraft = !!post && post.published_at === null;
  const [caption, setCaption] = useState(post?.caption ?? '');
  const [visibility, setVisibility] = useState<Visibility>((post?.visibility as Visibility | undefined) ?? defaultVisibility);
  const [photos, setPhotos] = useState<PickedMedia[]>([]);
  const [attached, setAttached] = useState<Set<string>>(
    () => new Set(seed.reactions.filter((r) => !post || r.post_id === post.id || r.post_id === null).map((r) => r.id)),
  );
  const [skipped, setSkipped] = useState(0);
  const room = MAX_POST_PHOTOS - seed.photoPaths.length - photos.length;

  const addPhotos = async () => {
    const picked = await pickMedia();
    const stills = picked.filter((m) => m.kind === 'photo');
    setSkipped(picked.length - stills.length);
    setPhotos((cur) => [...cur, ...stills].slice(0, MAX_POST_PHOTOS - seed.photoPaths.length));
  };

  const submit = (publishNow: boolean) =>
    save.mutate(
      {
        attendanceId,
        postId: post?.id ?? null,
        caption,
        visibility,
        newPhotos: photos,
        reactionIds: [...attached],
        publishNow,
      },
      {
        onSuccess: (postId) => {
          router.back();
          if (!isDraft || publishNow) router.push(`/post/${postId}` as Href);
        },
      },
    );

  const companions = (attendance.data?.companions ?? [])
    .map((c) => (c.person ? `${c.person.display_name}${c.status === 'pending' ? ' (asked)' : ''}` : null))
    .filter(Boolean)
    .join(', ');

  return (
    <FormScreen headerOffset={60}>
      {isDraft ? (
        <Notice>{`${draftCountdown(post?.publish_at ?? null)}. Edit it now, or post it straight away.`}</Notice>
      ) : null}
      <TextField
        label="Caption"
        value={caption}
        onChangeText={setCaption}
        placeholder="How was it?"
        multiline
        maxLength={2000}
        accessibilityLabel="Caption"
      />

      <SectionHeader title="Photos" action={room > 0 ? 'Add' : undefined} onAction={() => void addPhotos()} />
      {seed.photoPaths.length || photos.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {seed.photoPaths.map((p) => (
            <PostImage key={p} bucket="post-photos" path={p} style={{ width: 72, height: 72 }} />
          ))}
          {photos.map((m) => (
            <Image
              key={m.uri}
              source={{ uri: m.uri }}
              style={{ width: 72, height: 72, borderRadius: theme.radius.md }}
              accessibilityLabel="A photo to add"
            />
          ))}
        </View>
      ) : (
        <Button title="Add photos" variant="secondary" small onPress={() => void addPhotos()} style={{ alignSelf: 'flex-start' }} />
      )}
      {skipped > 0 ? (
        <Text variant="caption" color="muted">
          Videos stay on the game page; posts take photos.
        </Text>
      ) : null}

      {seed.reactions.length ? (
        <>
          <SectionHeader title="Reactions from this game" />
          <Card>
            {seed.reactions.map((r, i) => (
              <CheckRow
                key={r.id}
                first={i === 0}
                title={r.period_label ? `Reaction, ${r.period_label}` : 'Reaction'}
                subtitle="Stays in the feed as its own post too"
                checked={attached.has(r.id)}
                onToggle={() =>
                  setAttached((cur) => {
                    const next = new Set(cur);
                    if (next.has(r.id)) next.delete(r.id);
                    else next.add(r.id);
                    return next;
                  })
                }
              />
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Who sees it" />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {VISIBILITIES.map((v) => (
          <Chip key={v} label={VISIBILITY_LABEL[v]} selected={visibility === v} onPress={() => setVisibility(v)} />
        ))}
      </View>

      <SectionHeader title="With" action="Edit" onAction={() => router.push(`/games/log/${seed.gameId}` as Href)} />
      <Text variant="sub" color="muted">
        {companions || 'Nobody tagged. Friends with an account are asked before it shows for them.'}
      </Text>

      {save.error ? (
        <Notice tone="error">{friendlySocialError(save.error) ?? 'That did not save. Try again.'}</Notice>
      ) : null}
      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
        {isDraft ? (
          <>
            <Button title="Post now" loading={save.isPending && save.variables?.publishNow} onPress={() => submit(true)} />
            <Button
              title="Save, post on time"
              variant="secondary"
              loading={save.isPending && !save.variables?.publishNow}
              onPress={() => submit(false)}
            />
          </>
        ) : (
          <Button title={post ? 'Save' : 'Post'} loading={save.isPending} onPress={() => submit(false)} />
        )}
      </View>
    </FormScreen>
  );
}
