import {
  draftCountdown,
  gameDate,
  ordinal,
  postHeadline,
  postKicker,
  postMeta,
  resultLetter,
  scoreLine,
  withLine,
} from '../copy';
import { DEMO_POSTS } from '../demo';
import { friendlySocialError, isRateLimited } from '../errors';
import { FEED_PAGE, nextCursor, toggledKudos } from '../queries';
import type { Post, PostGame } from '../types';

const byKind = (kind: Post['kind']) => DEMO_POSTS.find((p) => p.kind === kind)!;

const game: PostGame = {
  id: 'g',
  sport_id: 'mlb',
  status: 'final',
  scheduled_start: '2026-09-21T02:10:00Z',
  home_team_id: 'h',
  away_team_id: 'a',
  home_name: 'Dodgers',
  away_name: 'Phillies',
  home_abbr: 'LAD',
  away_abbr: 'PHI',
  home_score: 2,
  away_score: 7,
  winner_team_id: 'a',
  is_tie: false,
  venue_name: 'Dodger Stadium',
  venue_tz: 'America/Los_Angeles',
  famous_title: null,
};

describe('headlines, one per kind', () => {
  it('says each kind of post plainly', () => {
    expect(postHeadline(byKind('game'))).toBe('Phillies 7, Mets 2');
    expect(postHeadline(byKind('reaction'))).toBe('Reaction, 3rd inning');
    expect(postHeadline(byKind('stamp'))).toBe('Unlocked Wrigley Field');
    expect(postHeadline(byKind('milestone'))).toBe('50th game attended');
    expect(postHeadline(byKind('goal'))).toBe('Finished Every NL West park');
    expect(postHeadline(byKind('wrapped'))).toBe('MLB 2026 Wrapped is out');
    expect(postHeadline(byKind('badge'))).toBe('Earned Walk-off witnessed');
  });

  it('puts the winner first once final, and says "at" before', () => {
    expect(scoreLine(game)).toBe('Phillies 7, Dodgers 2');
    expect(scoreLine({ ...game, winner_team_id: 'h', home_score: 9 })).toBe('Dodgers 9, Phillies 7');
    expect(scoreLine({ ...game, status: 'scheduled' })).toBe('Phillies at Dodgers');
  });

  it('dates a late West Coast game in its own time zone', () => {
    // 02:10 UTC on the 21st is 7:10 pm on the 20th in Los Angeles.
    expect(gameDate(game, new Date('2026-09-22T00:00:00Z'))).toBe('Sep 20');
    expect(gameDate({ ...game, scheduled_start: '2024-05-01T20:00:00Z' }, new Date('2026-09-22T00:00:00Z'))).toBe(
      'May 1, 2024',
    );
  });

  it('kickers and meta lines', () => {
    expect(postKicker(byKind('stamp'))).toBe('New stamp');
    expect(postMeta(byKind('game'))).toBe('with Dad and Jordan Blake · 3 photos · 1 reaction');
    expect(withLine(['Dad', 'Maya', 'Sam'])).toBe('with Dad, Maya and Sam');
    expect(withLine([])).toBeNull();
  });

  it('small pieces', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(22)).toBe('22nd');
    expect(resultLetter('win')).toBe('W');
    expect(resultLetter(null)).toBeNull();
    const now = new Date('2026-09-22T20:00:00Z');
    expect(draftCountdown('2026-09-22T20:12:00Z', now)).toBe('Posts in 12 min');
    expect(draftCountdown('2026-09-22T20:00:30Z', now)).toBe('Posts in a minute');
  });
});

describe('kudos and paging', () => {
  it('a tap flips kudos and the count follows, and a second tap undoes it', () => {
    const p = byKind('stamp');
    const once = toggledKudos(p);
    expect(once).toMatchObject({ myKudos: true, kudosCount: p.kudosCount + 1 });
    expect(toggledKudos(once)).toMatchObject({ myKudos: false, kudosCount: p.kudosCount });
  });

  it('the next page starts after the last post by (published_at, id), and a short page ends it', () => {
    const page = Array.from({ length: FEED_PAGE }, (_, i) => ({
      ...byKind('stamp'),
      id: `p${i}`,
      publishedAt: `2026-09-2${i % 3}T00:00:00Z`,
    }));
    expect(nextCursor(page)).toEqual({ at: page[FEED_PAGE - 1]!.publishedAt, id: `p${FEED_PAGE - 1}` });
    expect(nextCursor(page.slice(0, 3))).toBeUndefined();
  });
});

describe('friendly errors', () => {
  it('turns a rate limit into a sentence, per action', () => {
    const e = { code: 'JX429', message: 'rate_limited: comment' };
    expect(isRateLimited(e)).toBe(true);
    expect(friendlySocialError(e)).toBe('Slow down a little. You can comment again in a few minutes.');
    expect(friendlySocialError({ code: 'JX429', message: 'rate_limited: kudos' })).toMatch(/kudos/);
  });

  it('turns a refused name into a sentence, and leaves other errors alone', () => {
    expect(friendlySocialError({ code: 'JX451', message: 'profane_name: handle' })).toBe(
      'That handle will not work here. Try another.',
    );
    expect(friendlySocialError({ code: '23505', message: 'duplicate' })).toBeNull();
    expect(friendlySocialError(null)).toBeNull();
  });
});
