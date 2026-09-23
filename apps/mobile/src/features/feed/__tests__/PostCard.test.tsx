import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { renderScreen as renderBare } from '@/test/renderScreen';
import { ReferenceThemeProvider } from '@/theme/reference/TeamTheme';
import { companionDiff } from '@/features/attendances/queries';
import { notificationRoute } from '@/features/notifications/queries';
import { DEMO_POSTS } from '../demo';
import { toPost } from '../types';
import { authorSide, PostCard } from '../ui/PostCard';
import { tagQuestion } from '../ui/PendingTags';
import { bannerItems } from '../ui/YourPost';

jest.mock('@/lib/supabase', () => ({ supabase: { storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: null }) }) } } }));

const noop = () => undefined;

// The app root provides the reference theme that a card's TeamTheme nests inside.
const renderScreen = (ui: React.ReactElement) => renderBare(<ReferenceThemeProvider>{ui}</ReferenceThemeProvider>);

describe('PostCard', () => {
  it.each(DEMO_POSTS.map((p) => [p.kind, p] as const))('draws a %s post', async (_kind, post) => {
    const screen = await renderScreen(
      <PostCard post={post} meId="someone-else" onOpen={noop} onOpenAuthor={noop} onKudos={noop} onComments={noop} onMore={noop} />,
    );
    expect(screen.getByText(post.author.displayName)).toBeTruthy();
  });

  it('shows the superfan badge, the result and the counts', async () => {
    const creator = DEMO_POSTS.find((p) => p.author.isCreator)!;
    const screen = await renderScreen(
      <PostCard post={creator} meId="me" onOpen={noop} onOpenAuthor={noop} onKudos={noop} onComments={noop} onMore={noop} />,
    );
    expect(screen.getByText('Superfan')).toBeTruthy();
    expect(screen.getByLabelText('Win')).toBeTruthy();
    expect(screen.getByLabelText('Give kudos, 412')).toBeTruthy();
    expect(screen.getByLabelText('Comments, 37')).toBeTruthy();
  });

  it('has no kudos button on your own post', async () => {
    const mine = DEMO_POSTS[1]!;
    const screen = await renderScreen(
      <PostCard post={mine} meId={mine.author.id} onOpen={noop} onOpenAuthor={noop} onKudos={noop} onComments={noop} onMore={noop} />,
    );
    expect(screen.queryByLabelText(/kudos/i)).toBeNull();
    expect(screen.getByText('31 kudos')).toBeTruthy();
    expect(screen.getByLabelText('Post options')).toBeTruthy();
  });

  it('kudos is one tap', async () => {
    const onKudos = jest.fn();
    const post = DEMO_POSTS[2]!;
    const screen = await renderScreen(
      <PostCard post={post} meId="me" onOpen={noop} onOpenAuthor={noop} onKudos={onKudos} onComments={noop} onMore={noop} />,
    );
    fireEvent.press(screen.getByLabelText(`Give kudos, ${post.kudosCount}`));
    expect(onKudos).toHaveBeenCalledTimes(1);
  });

  it('colours a game post by the side the author was on', () => {
    const g = DEMO_POSTS[1]!;
    expect(authorSide(g)).toBe('phi');
    expect(authorSide({ ...g, result: 'loss' })).toBe('nym');
    expect(authorSide({ ...g, result: null })).toBeNull();
  });
});

describe('mapping rows', () => {
  it('drops a row it cannot draw and keeps a good one', () => {
    const good = {
      id: 'p',
      kind: 'milestone',
      author_id: 'u',
      author_handle: 'maya',
      author_display_name: 'Maya',
      author_avatar_path: null,
      author_is_creator: false,
      caption: null,
      visibility: 'followers',
      created_at: '2026-09-22T00:00:00Z',
      published_at: '2026-09-22T00:00:00Z',
      publish_at: null,
      auto_posted: false,
      payload: { games: 10 },
      game: null,
      result: null,
      kudos_count: 2,
      my_kudos: false,
      comment_count: 1,
      photos: [],
      reactions: [],
      companions: [{ name: 'Dad', handle: null }, { nope: true }],
      community: null,
    };
    expect(toPost(good)).toMatchObject({ kind: 'milestone', kudosCount: 2, companions: [{ name: 'Dad', handle: null }] });
    expect(toPost({ ...good, kind: 'mystery' })).toBeNull();
    expect(toPost({ ...good, author_handle: null })).toBeNull();
  });
});

describe('the pieces around posts', () => {
  it('asks a tagged friend in one line', () => {
    expect(
      tagQuestion({ taggerName: 'Dean', awayName: 'Mets', homeName: 'Phillies', scheduledStart: '2026-09-20T17:05:00Z' }),
    ).toBe('Dean says you were at Mets at Phillies, Sep 20. Add it?');
  });

  it('an edit only touches the tags that changed, so a friend is never asked twice', () => {
    expect(companionDiff(['dad', 'maya'], ['maya', 'sam'])).toEqual({ removed: ['dad'], added: ['sam'] });
    expect(companionDiff(['maya'], ['maya'])).toEqual({ removed: [], added: [] });
  });

  it('the Games banner: drafts first, then last week\'s unposted games, three at most', () => {
    const now = new Date('2026-09-22T20:00:00Z');
    const s = (id: string, state: 'draft' | 'posted' | 'unposted', endedAt: string) => ({
      attendanceId: id,
      gameId: id,
      postId: null,
      state,
      publishAt: null,
      label: id,
      endedAt,
    });
    const items = bannerItems(
      [
        s('old', 'unposted', '2026-08-01T00:00:00Z'),
        s('posted', 'posted', '2026-09-22T00:00:00Z'),
        s('recent', 'unposted', '2026-09-21T00:00:00Z'),
        s('draft', 'draft', '2026-09-22T19:30:00Z'),
      ],
      now,
    );
    expect(items.map((i) => i.attendanceId)).toEqual(['draft', 'recent']);
  });

  it('kudos and comment notifications open the post; a pending tag opens the feed', () => {
    expect(notificationRoute({ kind: 'kudos', data: { post_id: 'p1' } })).toBe('/post/p1');
    expect(notificationRoute({ kind: 'comment', data: { post_id: 'p2' } })).toBe('/post/p2');
    expect(notificationRoute({ kind: 'tagged', data: { pending: true, game_id: 'g' } })).toBe('/feed');
    expect(notificationRoute({ kind: 'tagged', data: { game_id: 'g' } })).toBe('/games/g');
  });
});
