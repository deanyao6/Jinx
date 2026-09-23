import type { Post, PostGame } from './types';

/**
 * Every sentence a post card says, as pure functions so the copy is tested without rendering.
 * No em dashes (copy.test.ts in features/games scans this folder too).
 */

export function authorName(post: Pick<Post, 'author'>): string {
  return post.author.displayName.trim() || post.author.handle;
}

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 50th. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "Phillies 7, Mets 2": the winner first once final, "Mets at Phillies" before. */
export function scoreLine(g: PostGame): string {
  const home = g.home_name ?? g.home_abbr ?? 'Home';
  const away = g.away_name ?? g.away_abbr ?? 'Away';
  if (g.status !== 'final' || g.home_score === null || g.away_score === null) return `${away} at ${home}`;
  const awayWon = g.winner_team_id === g.away_team_id;
  return awayWon
    ? `${away} ${g.away_score}, ${home} ${g.home_score}`
    : `${home} ${g.home_score}, ${away} ${g.away_score}`;
}

/** "Sep 20", in the venue's own time zone so a late West Coast game keeps its date. */
export function gameDate(g: Pick<PostGame, 'scheduled_start' | 'venue_tz'>, now = new Date()): string {
  const d = new Date(g.scheduled_start);
  if (Number.isNaN(d.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (g.venue_tz) opts.timeZone = g.venue_tz;
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  try {
    return new Intl.DateTimeFormat('en-US', opts).format(d);
  } catch {
    delete opts.timeZone;
    return new Intl.DateTimeFormat('en-US', opts).format(d);
  }
}

const SPORT_LABEL: Record<string, string> = { mlb: 'MLB', nfl: 'NFL', nba: 'NBA', mls: 'MLS' };

function payloadString(post: Post, key: string): string | null {
  const v = post.payload[key];
  return typeof v === 'string' && v.trim() ? v : null;
}

function payloadNumber(post: Post, key: string): number | null {
  const v = post.payload[key];
  return typeof v === 'number' ? v : null;
}

/** The big line of a card. */
export function postHeadline(post: Post): string {
  switch (post.kind) {
    case 'game':
      return post.game ? scoreLine(post.game) : 'A game';
    case 'reaction': {
      const at = post.reactions[0]?.period_label;
      return at ? `Reaction, ${at}` : 'Live reaction';
    }
    case 'stamp': {
      const venue = payloadString(post, 'venue_name');
      return venue ? `Unlocked ${venue}` : 'A new stamp';
    }
    case 'milestone': {
      const n = payloadNumber(post, 'games');
      return n ? `${ordinal(n)} game attended` : 'A milestone';
    }
    case 'goal': {
      const title = payloadString(post, 'title');
      return title ? `Finished ${title}` : 'Finished a goal';
    }
    case 'wrapped': {
      const sport = payloadString(post, 'sport_id');
      const season = payloadNumber(post, 'season');
      const label = sport ? (SPORT_LABEL[sport] ?? sport.toUpperCase()) : '';
      return [label, season, 'Wrapped is out'].filter(Boolean).join(' ');
    }
    case 'badge': {
      const name = payloadString(post, 'name');
      return name ? `Earned ${name}` : 'Earned a badge';
    }
  }
}

/** The line under the author's name: what kind of post, and where or when. */
export function postKicker(post: Post, now = new Date()): string {
  const date = post.game ? gameDate(post.game, now) : '';
  switch (post.kind) {
    case 'game':
      return [date, post.game?.venue_name].filter(Boolean).join(', ');
    case 'reaction':
      return ['Live reaction', date].filter(Boolean).join(', ');
    case 'stamp':
      return 'New stamp';
    case 'milestone':
      return 'Milestone';
    case 'goal':
      return 'Goal complete';
    case 'wrapped':
      return 'Season recap';
    case 'badge':
      return 'Badge earned';
  }
}

/** "with Dad and Maya", "with Dad, Maya and Sam". */
export function withLine(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `with ${names[0]}`;
  return `with ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The small meta line of a game post: companions, photos and reactions attached. */
export function postMeta(post: Post): string | null {
  const parts: string[] = [];
  const w = withLine(post.companions.map((c) => c.name));
  if (w) parts.push(w);
  if (post.kind === 'game') {
    if (post.photos.length) parts.push(post.photos.length === 1 ? '1 photo' : `${post.photos.length} photos`);
    if (post.reactions.length) {
      parts.push(post.reactions.length === 1 ? '1 reaction' : `${post.reactions.length} reactions`);
    }
  }
  return parts.length ? parts.join(' · ') : null;
}

export function resultLetter(result: Post['result']): 'W' | 'L' | 'T' | null {
  return result === 'win' ? 'W' : result === 'loss' ? 'L' : result === 'tie' ? 'T' : null;
}

/** "Posts in 12 min" for a draft in its edit window. */
export function draftCountdown(publishAt: string | null, now = new Date()): string {
  if (!publishAt) return 'Posts soon';
  const min = Math.ceil((new Date(publishAt).getTime() - now.getTime()) / 60000);
  if (!Number.isFinite(min) || min <= 1) return 'Posts in a minute';
  return `Posts in ${min} min`;
}

export const VISIBILITY_LABEL = {
  followers: 'Followers',
  public: 'Everyone',
  private: 'Only me',
} as const;

export const COMMENT_MAX = 500;
