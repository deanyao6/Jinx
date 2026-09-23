import React from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/Card';
import { IconTile } from '@/components/IconTile';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Text } from '@/components/Text';
import { ICONS, type IconName } from '@/components/reference/icons';
import { relativeTime } from '@/features/social/copy';
import { TeamTheme } from '@/theme/reference/TeamTheme';
import { alpha } from '@/theme/color';
import { useTheme } from '@/theme/ThemeProvider';
import { authorName, postHeadline, postKicker, postMeta, resultLetter } from '../copy';
import type { Post } from '../types';
import { PostImage } from './PostImage';

const SYSTEM_ICON: Record<'stamp' | 'milestone' | 'goal' | 'wrapped' | 'badge', IconName> = {
  stamp: 'i-passport',
  milestone: 'i-trend',
  goal: 'i-target',
  wrapped: 'i-spark',
  badge: 'i-verified',
};

/** The side the author was on, when the post says: it colours the card. */
export function authorSide(post: Post): string | null {
  const g = post.game;
  if (!g || !g.winner_team_id) return null;
  if (post.result === 'win') return g.winner_team_id;
  if (post.result === 'loss') return g.winner_team_id === g.home_team_id ? g.away_team_id : g.home_team_id;
  return null;
}

type Props = {
  post: Post;
  /** The signed-in user: no kudos button on their own posts. */
  meId: string | null;
  onOpen?: () => void;
  onOpenAuthor: () => void;
  onKudos: () => void;
  onComments: () => void;
  onMore: () => void;
  /** On the post's own page the body is not a link and the caption is not clipped. */
  full?: boolean;
};

export function PostCard(props: Props) {
  const side = authorSide(props.post);
  return side ? (
    <TeamTheme team={side}>
      <Body {...props} />
    </TeamTheme>
  ) : (
    <Body {...props} />
  );
}

function Body({ post, meId, onOpen, onOpenAuthor, onKudos, onComments, onMore, full = false }: Props) {
  const theme = useTheme();
  const name = authorName(post);
  const letter = resultLetter(post.result);
  const meta = postMeta(post);
  const mine = meId === post.author.id;
  const when = post.publishedAt ? relativeTime(post.publishedAt) : 'Draft';
  const kicker = [postKicker(post), when].filter(Boolean).join(' · ');

  return (
    <Card style={{ paddingBottom: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}, @${post.author.handle}`}
          onPress={onOpenAuthor}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, opacity: pressed ? 0.6 : 1 })}
        >
          <PersonAvatar
            userId={post.author.id}
            name={post.author.displayName}
            handle={post.author.handle}
            path={post.author.avatarPath}
            size={36}
          />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                {name}
              </Text>
              {post.author.isCreator ? <Pill label="Superfan" tone="gold" /> : null}
            </View>
            <Text variant="caption" color="muted" numberOfLines={1}>
              {kicker}
            </Text>
          </View>
        </Pressable>
        {letter ? <ResultBadge letter={letter} /> : null}
      </View>

      <Pressable
        accessibilityRole={onOpen ? 'button' : undefined}
        accessibilityLabel={onOpen ? `Open ${postHeadline(post)}` : undefined}
        disabled={!onOpen}
        onPress={onOpen}
        style={({ pressed }) => ({ marginTop: theme.spacing.md, opacity: pressed ? 0.7 : 1 })}
      >
        {post.kind === 'stamp' ||
        post.kind === 'milestone' ||
        post.kind === 'goal' ||
        post.kind === 'wrapped' ||
        post.kind === 'badge' ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: theme.radius.md,
              backgroundColor: theme.accent.wash,
            }}
          >
            <IconTile icon={SYSTEM_ICON[post.kind]} solid />
            <Text variant="h2" style={{ flex: 1 }}>
              {postHeadline(post)}
            </Text>
          </View>
        ) : (
          <Text variant="h2">{postHeadline(post)}</Text>
        )}
        {post.game?.famous_title ? (
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            <Pill label={post.game.famous_title} tone="gold" />
          </View>
        ) : null}
        {post.caption ? (
          <Text variant="body" numberOfLines={full ? undefined : 4} style={{ marginTop: 6 }}>
            {post.caption}
          </Text>
        ) : null}
        {meta ? (
          <Text variant="caption" color="muted" style={{ marginTop: 4 }}>
            {meta}
          </Text>
        ) : null}
        <Media post={post} full={full} />
        {post.community ? (
          <Text variant="caption" color="accent" style={{ marginTop: 8 }}>
            In {post.community.name}
          </Text>
        ) : null}
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: theme.spacing.sm }}>
        {mine ? (
          <Text variant="caption" color="muted" style={{ paddingVertical: 8, paddingRight: 8 }}>
            {post.kudosCount === 1 ? '1 kudos' : `${post.kudosCount} kudos`}
          </Text>
        ) : (
          <Action
            icon="i-spark"
            label={post.kudosCount > 0 ? String(post.kudosCount) : 'Kudos'}
            a11y={post.myKudos ? `Kudos given, ${post.kudosCount}. Tap to take it back` : `Give kudos, ${post.kudosCount}`}
            on={post.myKudos}
            onPress={onKudos}
          />
        )}
        <Action
          icon="i-users"
          label={post.commentCount > 0 ? String(post.commentCount) : 'Comment'}
          a11y={`Comments, ${post.commentCount}`}
          onPress={onComments}
        />
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mine ? 'Post options' : 'Report, mute or block'}
          hitSlop={8}
          onPress={onMore}
          style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.5 : 1 })}
        >
          <Text variant="bodyStrong" color="muted" style={{ letterSpacing: 2 }}>
            ···
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

function Media({ post, full }: { post: Post; full: boolean }) {
  const theme = useTheme();
  if (post.kind === 'reaction' && post.reactions[0]) {
    const r = post.reactions[0];
    return (
      <View style={{ marginTop: theme.spacing.sm, aspectRatio: 4 / 3 }}>
        <PostImage bucket="reaction-photos" path={r.back_path} style={{ flex: 1 }} accessibilityLabel="The play" />
        <PostImage
          bucket="reaction-photos"
          path={r.front_path}
          accessibilityLabel="The fan"
          style={{ position: 'absolute', top: 10, left: 10, width: '30%', aspectRatio: 3 / 4 }}
        />
      </View>
    );
  }
  if (post.kind !== 'game' || (post.photos.length === 0 && post.reactions.length === 0)) return null;
  const tiles = [
    ...post.photos.map((p) => ({ bucket: 'post-photos' as const, path: p })),
    ...post.reactions.map((r) => ({ bucket: 'reaction-photos' as const, path: r.back_path })),
  ];
  const shown = full ? tiles : tiles.slice(0, 3);
  const extra = tiles.length - shown.length;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing.sm }}>
      {shown.map((t, i) => (
        <View key={`${t.path}-${i}`} style={{ width: full ? '48.5%' : '32%', aspectRatio: 1 }}>
          <PostImage bucket={t.bucket} path={t.path} style={{ flex: 1 }} accessibilityLabel={`Photo ${i + 1}`} />
          {extra > 0 && i === shown.length - 1 ? (
            <View
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: theme.radius.md,
                backgroundColor: alpha('#000000', 0.45),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="bodyStrong" style={{ color: '#FFFFFF' }}>
                +{extra}
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function Action({
  icon,
  label,
  a11y,
  on = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  a11y: string;
  on?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const Icon = ICONS[icon];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 11,
        borderRadius: theme.radius.pill,
        backgroundColor: on ? theme.accent.fill : theme.colors.tint,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon color={on ? theme.accent.onFill : theme.colors.ink} size={16} />
      <Text variant="label" style={{ color: on ? theme.accent.onFill : theme.colors.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ResultBadge({ letter }: { letter: 'W' | 'L' | 'T' }) {
  const theme = useTheme();
  const fill = letter === 'W' ? theme.colors.green : letter === 'L' ? theme.colors.red : theme.colors.muted;
  return (
    <View
      accessibilityLabel={letter === 'W' ? 'Win' : letter === 'L' ? 'Loss' : 'Tie'}
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: alpha(fill, 0.16),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="bodyStrong" style={{ color: fill }}>
        {letter}
      </Text>
    </View>
  );
}

export function Pill({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'gold' }) {
  const theme = useTheme();
  const color = tone === 'gold' ? theme.colors.gold : theme.accent.text;
  return (
    <View
      style={{
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: theme.radius.pill,
        backgroundColor: alpha(color, 0.16),
      }}
    >
      <Text variant="label" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
