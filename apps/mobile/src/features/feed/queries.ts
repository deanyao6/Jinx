import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

import { useAuthStore } from '@/features/auth/store';
import { uploadTypeFor, type PickedMedia } from '@/features/relive/photos';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { DEMO_COMMENTS, DEMO_DISCOVER, DEMO_POSTS } from './demo';
import { toPost, type FeedSegment, type Post, type PostKind, type Visibility } from './types';

/**
 * The v2 feed (social brief 02). Everything a card shows comes from `post_cards()` on the
 * server, which already applies visibility, blocks both ways and mutes, and counts kudos and
 * comments per viewer. This file only pages, caches and patches.
 */

export const FEED_PAGE = 20;

export const feedKeys = {
  all: ['feed'] as const,
  segment: (userId: string | null, segment: FeedSegment) => ['feed', 'segment', userId, segment] as const,
  post: (userId: string | null, postId: string) => ['feed', 'post', userId, postId] as const,
  profile: (userId: string | null, authorId: string) => ['feed', 'profile', userId, authorId] as const,
  comments: (userId: string | null, postId: string) => ['feed', 'comments', userId, postId] as const,
  discover: (userId: string | null) => ['feed', 'discover-people', userId] as const,
  myPosts: (userId: string | null) => ['feed', 'my-post-states', userId] as const,
  settings: (userId: string | null) => ['feed', 'settings', userId] as const,
  mutes: (userId: string | null) => ['feed', 'mutes', userId] as const,
  pendingTags: (userId: string | null) => ['feed', 'pending-tags', userId] as const,
  compatibility: (userId: string | null, other: string) => ['feed', 'compatibility', userId, other] as const,
  recordWith: (userId: string | null, other: string) => ['feed', 'record-with', userId, other] as const,
};

export type FeedCursor = { at: string; id: string } | null;

/** The cursor after a page: the last post's (published_at, id), or none when the page was short. */
export function nextCursor(page: readonly Post[], size = FEED_PAGE): FeedCursor | undefined {
  if (page.length < size) return undefined;
  const last = page[page.length - 1];
  return last?.publishedAt ? { at: last.publishedAt, id: last.id } : undefined;
}

function rows(data: Parameters<typeof toPost>[0][] | null): Post[] {
  return (data ?? []).map(toPost).filter((p): p is Post => p !== null);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export function useFeed(segment: FeedSegment) {
  const userId = useAuthStore((s) => s.userId);
  return useInfiniteQuery({
    queryKey: feedKeys.segment(userId, segment),
    initialPageParam: null as FeedCursor,
    queryFn: async ({ pageParam }): Promise<Post[]> => {
      if (env.demo) {
        return segment === 'following'
          ? DEMO_POSTS.filter((p) => !p.author.isCreator)
          : DEMO_POSTS.filter((p) => p.author.isCreator);
      }
      const { data, error } = await supabase.rpc('feed_posts', {
        p_segment: segment,
        p_before_at: pageParam?.at,
        p_before_id: pageParam?.id,
        p_limit: FEED_PAGE,
      });
      if (error) throw error;
      return rows(data);
    },
    getNextPageParam: (last) => (env.demo ? undefined : nextCursor(last)),
    enabled: !!userId || env.demo,
    staleTime: 30_000,
  });
}

export function usePost(postId: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: feedKeys.post(userId, postId ?? ''),
    queryFn: async (): Promise<Post | null> => {
      if (env.demo) return DEMO_POSTS.find((p) => p.id === postId) ?? DEMO_POSTS[1] ?? null;
      const { data, error } = await supabase.rpc('post_card', { p_post_id: postId as string });
      if (error) throw error;
      return rows(data)[0] ?? null;
    },
    enabled: (!!userId || env.demo) && !!postId,
    staleTime: 15_000,
  });
}

export function useProfilePosts(authorId: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: feedKeys.profile(userId, authorId ?? ''),
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await supabase.rpc('profile_posts', {
        p_user_id: authorId as string,
        p_limit: 10,
      });
      if (error) throw error;
      return rows(data);
    },
    enabled: !!userId && !!authorId && !env.demo,
    staleTime: 30_000,
  });
}

export type Comment = {
  id: string;
  authorId: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
  body: string;
  createdAt: string;
  canDelete: boolean;
};

export function useComments(postId: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: feedKeys.comments(userId, postId ?? ''),
    queryFn: async (): Promise<Comment[]> => {
      if (env.demo) {
        return DEMO_COMMENTS.map((c, i) => ({
          id: c.id,
          authorId: c.author.id,
          handle: c.author.handle,
          displayName: c.author.displayName,
          avatarPath: null,
          body: c.body,
          createdAt: new Date(Date.now() - (3 - i) * 3600_000).toISOString(),
          canDelete: c.mine,
        }));
      }
      const { data, error } = await supabase.rpc('post_comments', { p_post_id: postId as string });
      if (error) throw error;
      return data.map((c) => ({
        id: c.id,
        authorId: c.author_id,
        handle: c.author_handle,
        displayName: c.author_display_name,
        avatarPath: c.author_avatar_path,
        body: c.body,
        createdAt: c.created_at,
        canDelete: c.can_delete,
      }));
    },
    enabled: (!!userId || env.demo) && !!postId,
    staleTime: 10_000,
  });
}

export type DiscoverPerson = {
  section: 'creator' | 'fan';
  userId: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
  isCreator: boolean;
  note: string | null;
  followers: number;
  sharedGames: number | null;
  lastGame: { id: string; label: string } | null;
};

export function useDiscoverPeople() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: feedKeys.discover(userId),
    queryFn: async (): Promise<DiscoverPerson[]> => {
      if (env.demo) {
        return [
          ...DEMO_DISCOVER.creators.map((c) => ({
            section: 'creator' as const,
            userId: c.id,
            handle: c.handle,
            displayName: c.displayName,
            avatarPath: null,
            isCreator: true,
            note: c.note,
            followers: c.followers,
            sharedGames: null,
            lastGame: null,
          })),
          ...DEMO_DISCOVER.fans.map((f) => ({
            section: 'fan' as const,
            userId: f.id,
            handle: f.handle,
            displayName: f.displayName,
            avatarPath: null,
            isCreator: false,
            note: null,
            followers: 0,
            sharedGames: f.sharedGames,
            lastGame: { id: 'demo-g1', label: f.lastGame },
          })),
        ];
      }
      const { data, error } = await supabase.rpc('discover_people');
      if (error) throw error;
      return data.map((r) => {
        const g = r.last_shared_game as Record<string, unknown> | null;
        const label =
          g && typeof g['home_name'] === 'string'
            ? `${String(g['away_name'])} at ${String(g['home_name'])}`
            : null;
        return {
          section: r.section === 'creator' ? 'creator' : 'fan',
          userId: r.user_id,
          handle: r.handle,
          displayName: r.display_name,
          avatarPath: r.avatar_path,
          isCreator: r.is_creator,
          note: r.creator_note,
          followers: r.followers_count,
          sharedGames: r.shared_games,
          lastGame: g && typeof g['id'] === 'string' && label ? { id: g['id'], label } : null,
        };
      });
    },
    enabled: !!userId || env.demo,
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Kudos: optimistic everywhere the post is cached
// ---------------------------------------------------------------------------

type FeedData = InfiniteData<Post[], FeedCursor>;

/** Applies `patch` to one post in every feed page, profile list and post page in the cache. */
export function patchPostEverywhere(qc: QueryClient, postId: string, patch: (p: Post) => Post) {
  qc.setQueriesData<FeedData>({ queryKey: ['feed', 'segment'] }, (data) =>
    data ? { ...data, pages: data.pages.map((page) => page.map((p) => (p.id === postId ? patch(p) : p))) } : data,
  );
  qc.setQueriesData<Post[]>({ queryKey: ['feed', 'profile'] }, (list) =>
    list ? list.map((p) => (p.id === postId ? patch(p) : p)) : list,
  );
  qc.setQueriesData<Post | null>({ queryKey: ['feed', 'post'] }, (p) => (p && p.id === postId ? patch(p) : p));
}

/** The kudos a tap would leave: on becomes off and back, and the count follows. */
export function toggledKudos(p: Post): Post {
  return p.myKudos
    ? { ...p, myKudos: false, kudosCount: Math.max(0, p.kudosCount - 1) }
    : { ...p, myKudos: true, kudosCount: p.kudosCount + 1 };
}

export function useToggleKudos() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (post: Post) => {
      if (env.demo) return;
      if (!userId) throw new Error('Not signed in');
      if (post.myKudos) {
        const { error } = await supabase.from('kudos').delete().eq('post_id', post.id).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('kudos').insert({ post_id: post.id, user_id: userId });
        if (error) throw error;
      }
    },
    onMutate: async (post) => {
      await qc.cancelQueries({ queryKey: feedKeys.all });
      patchPostEverywhere(qc, post.id, toggledKudos);
      return { post };
    },
    onError: (_e, post) => {
      // Put it back exactly as it was: the server said no (a rate limit, a post gone).
      patchPostEverywhere(qc, post.id, () => post);
    },
  });
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (body: string) => {
      if (!userId) throw new Error('Not signed in');
      const text = body.trim();
      if (!text) throw new Error('Write something first');
      const { error } = await supabase.from('comments').insert({ post_id: postId, author_id: userId, body: text });
      if (error) throw error;
    },
    onSuccess: () => {
      patchPostEverywhere(qc, postId, (p) => ({ ...p, commentCount: p.commentCount + 1 }));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: feedKeys.comments(userId, postId) }),
  });
}

export function useDeleteComment(postId: string) {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      patchPostEverywhere(qc, postId, (p) => ({ ...p, commentCount: Math.max(0, p.commentCount - 1) }));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: feedKeys.comments(userId, postId) }),
  });
}

// ---------------------------------------------------------------------------
// My posts: drafts in their edit window, "Post this", editing, deleting
// ---------------------------------------------------------------------------

export type MyPostState = {
  attendanceId: string;
  gameId: string;
  postId: string | null;
  state: 'draft' | 'posted' | 'unposted';
  publishAt: string | null;
  /** "Mets at Phillies". */
  label: string;
  endedAt: string;
};

export function useMyPostStates() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: feedKeys.myPosts(userId),
    queryFn: async (): Promise<Map<string, MyPostState>> => {
      const { data, error } = await supabase.rpc('my_post_states');
      if (error) throw error;
      const out = new Map<string, MyPostState>();
      for (const r of data) {
        out.set(r.game_id, {
          attendanceId: r.attendance_id,
          gameId: r.game_id,
          postId: r.post_id,
          state: r.state === 'draft' || r.state === 'posted' ? r.state : 'unposted',
          publishAt: r.publish_at,
          label: `${r.away_name} at ${r.home_name}`,
          endedAt: r.ended_at,
        });
      }
      return out;
    },
    enabled: !!userId && !env.demo,
    // A draft's countdown matters to the minute.
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

function invalidateMine(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: feedKeys.all });
}

export function usePublishDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.rpc('publish_my_draft', { p_post_id: postId });
      if (error) throw error;
    },
    onSettled: () => invalidateMine(qc),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
    },
    onSettled: () => invalidateMine(qc),
  });
}

export type ComposerInput = {
  attendanceId: string;
  /** Present when editing a draft or a post; absent for "Post this". */
  postId: string | null;
  caption: string;
  visibility: Visibility;
  /** Photos picked on the phone, uploaded in order; existing ones are kept. */
  newPhotos: PickedMedia[];
  /** Reactions from this attendance to attach; any not listed are detached. */
  reactionIds: string[];
  /** For a draft: publish now instead of waiting out the window. */
  publishNow: boolean;
};

export const MAX_POST_PHOTOS = 10;

export function useSaveGamePost() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (input: ComposerInput): Promise<string> => {
      if (!userId) throw new Error('Not signed in');
      const caption = input.caption.trim() || null;
      let postId = input.postId;
      if (postId) {
        const { error } = await supabase
          .from('posts')
          .update({ caption, visibility: input.visibility })
          .eq('id', postId);
        if (error) throw error;
      } else {
        // The id is made here and the row is not read back: `insert ... returning` re-checks the
        // new row against the posts SELECT policy, whose can_view_post() cannot see a row its own
        // statement is inserting, so Postgres refuses the whole insert (pgTAP 070 pins this).
        postId = Crypto.randomUUID();
        const { error } = await supabase.from('posts').insert({
          id: postId,
          author_id: userId,
          kind: 'game' satisfies PostKind,
          attendance_id: input.attendanceId,
          caption,
          visibility: input.visibility,
        });
        if (error) throw error;
      }

      if (input.newPhotos.length) {
        const { data: existing, error } = await supabase
          .from('post_photos')
          .select('ordinal')
          .eq('post_id', postId);
        if (error) throw error;
        let ordinal = Math.max(-1, ...existing.map((r) => r.ordinal)) + 1;
        for (const photo of input.newPhotos) {
          if (ordinal >= MAX_POST_PHOTOS) break;
          const type = uploadTypeFor(photo);
          if (!type || photo.kind !== 'photo') continue;
          const path = `${userId}/${postId}/${ordinal}.${type.ext}`;
          const bytes = await new File(photo.uri).arrayBuffer();
          const up = await supabase.storage
            .from('post-photos')
            .upload(path, bytes, { contentType: type.contentType, upsert: false });
          if (up.error) throw up.error;
          const row = await supabase.from('post_photos').insert({ post_id: postId, storage_path: path, ordinal });
          if (row.error) throw row.error;
          ordinal += 1;
        }
      }

      // Attach the chosen reactions and detach the rest from this post.
      const detach = await supabase
        .from('reactions')
        .update({ post_id: null })
        .eq('post_id', postId)
        .not('id', 'in', `(${input.reactionIds.join(',') || '00000000-0000-0000-0000-000000000000'})`);
      if (detach.error) throw detach.error;
      if (input.reactionIds.length) {
        const attach = await supabase.from('reactions').update({ post_id: postId }).in('id', input.reactionIds);
        if (attach.error) throw attach.error;
      }

      if (input.publishNow) {
        const { error } = await supabase.rpc('publish_my_draft', { p_post_id: postId });
        if (error) throw error;
      }
      return postId;
    },
    onSettled: () => invalidateMine(qc),
  });
}

/** What the composer starts from: my attendance, its post if any, and my reactions there. */
export function useComposerSeed(attendanceId: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: ['feed', 'composer', userId, attendanceId],
    queryFn: async () => {
      const [att, post, reactions] = await Promise.all([
        supabase.from('attendances').select('id, game_id').eq('id', attendanceId as string).single(),
        supabase
          .from('posts')
          .select('id, caption, visibility, published_at, publish_at')
          .eq('attendance_id', attendanceId as string)
          .is('deleted_at', null)
          .maybeSingle(),
        supabase
          .from('reactions')
          .select('id, period_label, captured_at, post_id')
          .eq('attendance_id', attendanceId as string)
          .order('captured_at'),
      ]);
      if (att.error) throw att.error;
      if (post.error) throw post.error;
      if (reactions.error) throw reactions.error;
      const photos = post.data
        ? await supabase.from('post_photos').select('storage_path').eq('post_id', post.data.id).order('ordinal')
        : { data: [], error: null };
      if (photos.error) throw photos.error;
      return {
        gameId: att.data.game_id,
        post: post.data,
        photoPaths: (photos.data ?? []).map((p) => p.storage_path),
        reactions: reactions.data,
      };
    },
    enabled: !!userId && !!attendanceId,
  });
}

// ---------------------------------------------------------------------------
// Settings: auto-post, default audience, system post kinds
// ---------------------------------------------------------------------------

export type SystemPostKind = 'stamp' | 'milestone' | 'goal' | 'wrapped';
export type PostSettings = {
  autoPost: boolean;
  visibility: Visibility;
  mutedKinds: SystemPostKind[];
  discoverableByContacts: boolean;
};

export function usePostSettings() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: feedKeys.settings(userId),
    queryFn: async (): Promise<PostSettings> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('auto_post, post_visibility, muted_post_kinds, discoverable_by_contacts')
        .eq('id', userId as string)
        .single();
      if (error) throw error;
      return {
        autoPost: data.auto_post,
        visibility: data.post_visibility as Visibility,
        mutedKinds: data.muted_post_kinds as SystemPostKind[],
        discoverableByContacts: data.discoverable_by_contacts,
      };
    },
    enabled: !!userId,
  });
}

export function useUpdatePostSettings() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (patch: Partial<PostSettings>) => {
      const row: {
        auto_post?: boolean;
        post_visibility?: Visibility;
        muted_post_kinds?: SystemPostKind[];
        discoverable_by_contacts?: boolean;
      } = {};
      if (patch.autoPost !== undefined) row.auto_post = patch.autoPost;
      if (patch.visibility !== undefined) row.post_visibility = patch.visibility;
      if (patch.mutedKinds !== undefined) row.muted_post_kinds = patch.mutedKinds;
      if (patch.discoverableByContacts !== undefined) row.discoverable_by_contacts = patch.discoverableByContacts;
      const { error } = await supabase.from('profiles').update(row).eq('id', userId as string);
      if (error) throw error;
    },
    onMutate: async (patch) => {
      const key = feedKeys.settings(userId);
      const previous = qc.getQueryData<PostSettings>(key);
      if (previous) qc.setQueryData<PostSettings>(key, { ...previous, ...patch });
      return { previous };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.previous) qc.setQueryData(feedKeys.settings(userId), ctx.previous);
    },
    // Turning auto-post off removes any draft, so the Games banners change too.
    onSettled: () => qc.invalidateQueries({ queryKey: feedKeys.all }),
  });
}

// ---------------------------------------------------------------------------
// Mute
// ---------------------------------------------------------------------------

export function useMutedIds() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: feedKeys.mutes(userId),
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('mutes').select('muted_id');
      if (error) throw error;
      return new Set(data.map((r) => r.muted_id));
    },
    enabled: !!userId && !env.demo,
  });
}

export function useSetMuted() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async ({ userId: other, muted }: { userId: string; muted: boolean }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = muted
        ? await supabase.from('mutes').insert({ user_id: userId, muted_id: other })
        : await supabase.from('mutes').delete().eq('user_id', userId).eq('muted_id', other);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: feedKeys.all }),
  });
}

// ---------------------------------------------------------------------------
// Companion tags waiting for my answer (section 7)
// ---------------------------------------------------------------------------

export type PendingTag = {
  attendanceId: string;
  personId: string;
  taggerId: string;
  taggerHandle: string;
  taggerName: string;
  taggerAvatarPath: string | null;
  gameId: string;
  scheduledStart: string;
  homeName: string;
  awayName: string;
  venueName: string | null;
  alreadyLogged: boolean;
};

export function usePendingTags() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: feedKeys.pendingTags(userId),
    queryFn: async (): Promise<PendingTag[]> => {
      const { data, error } = await supabase.rpc('my_pending_tags');
      if (error) throw error;
      return data.map((r) => ({
        attendanceId: r.attendance_id,
        personId: r.person_id,
        taggerId: r.tagger_id,
        taggerHandle: r.tagger_handle,
        taggerName: r.tagger_display_name || r.tagger_handle,
        taggerAvatarPath: r.tagger_avatar_path,
        gameId: r.game_id,
        scheduledStart: r.scheduled_start,
        homeName: r.home_name,
        awayName: r.away_name,
        venueName: r.venue_name,
        alreadyLogged: r.already_logged,
      }));
    },
    enabled: !!userId && !env.demo,
    staleTime: 30_000,
  });
}

export function useAnswerTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tag: PendingTag; accept: boolean }) => {
      const { data, error } = await supabase.rpc('answer_companion_tag', {
        p_attendance_id: input.tag.attendanceId,
        p_person_id: input.tag.personId,
        p_accept: input.accept,
      });
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: feedKeys.all });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      // Accepting logs the game: every screen built on my attendances moves.
      qc.invalidateQueries();
    },
  });
}

// ---------------------------------------------------------------------------
// Compatibility and the record together (section 6)
// ---------------------------------------------------------------------------

export function useCompatibility(otherId: string | undefined, enabled: boolean) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: feedKeys.compatibility(userId, otherId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('compatibility_with', { p_other: otherId as string });
      if (error) throw error;
      return data[0] ?? null;
    },
    enabled: !!userId && !!otherId && enabled && !env.demo,
    staleTime: 60 * 60_000,
  });
}

export function useRecordWith(otherId: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: feedKeys.recordWith(userId, otherId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('record_with_user', { p_other: otherId as string });
      if (error) throw error;
      return data[0] ?? null;
    },
    enabled: !!userId && !!otherId && !env.demo,
    staleTime: 5 * 60_000,
  });
}
