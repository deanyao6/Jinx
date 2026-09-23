import type { Database, Json } from '@/lib/database.types';

type Row = Database['public']['CompositeTypes']['post_card_row'];

export type PostKind = 'game' | 'reaction' | 'stamp' | 'milestone' | 'goal' | 'wrapped';
export type FeedSegment = 'following' | 'discover';
export type Visibility = 'followers' | 'public' | 'private';

/** The game a post is about, as `post_cards()` sends it. */
export type PostGame = {
  id: string;
  sport_id: string;
  status: string;
  scheduled_start: string;
  home_team_id: string;
  away_team_id: string;
  home_name: string | null;
  away_name: string | null;
  home_abbr: string | null;
  away_abbr: string | null;
  home_score: number | null;
  away_score: number | null;
  winner_team_id: string | null;
  is_tie: boolean | null;
  venue_name: string | null;
  venue_tz: string | null;
  /** "Super Bowl LIX" when the game is a famous one. */
  famous_title: string | null;
};

export type PostReaction = {
  id: string;
  back_path: string;
  front_path: string;
  period_label: string | null;
  late_seconds: number | null;
  captured_at: string;
};

export type PostCompanion = { name: string; handle: string | null };

/** One post as every screen draws it: the feed, the post page, a profile, demo mode. */
export type Post = {
  id: string;
  kind: PostKind;
  author: {
    id: string;
    handle: string;
    displayName: string;
    avatarPath: string | null;
    isCreator: boolean;
  };
  caption: string | null;
  visibility: Visibility;
  publishedAt: string | null;
  /** When an auto-post draft goes up by itself; null once published. */
  publishAt: string | null;
  autoPosted: boolean;
  payload: Record<string, Json | undefined>;
  game: PostGame | null;
  /** The author's result at a game post: their side won, lost or tied. */
  result: 'win' | 'loss' | 'tie' | null;
  kudosCount: number;
  myKudos: boolean;
  commentCount: number;
  photos: string[];
  reactions: PostReaction[];
  companions: PostCompanion[];
  community: { slug: string; name: string } | null;
};

const KINDS: readonly PostKind[] = ['game', 'reaction', 'stamp', 'milestone', 'goal', 'wrapped'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function arrayOf<T>(v: Json | null | undefined, pick: (item: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const item of v) {
    if (!isRecord(item)) continue;
    const t = pick(item);
    if (t) out.push(t);
  }
  return out;
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/** Turns a `post_card_row` into a `Post`, or null for a row too broken to draw. */
export function toPost(row: Row): Post | null {
  if (!row.id || !row.author_id || !row.author_handle || !row.kind) return null;
  if (!KINDS.includes(row.kind as PostKind)) return null;
  const g = isRecord(row.game) ? row.game : null;
  const community = isRecord(row.community) ? row.community : null;
  return {
    id: row.id,
    kind: row.kind as PostKind,
    author: {
      id: row.author_id,
      handle: row.author_handle,
      displayName: row.author_display_name ?? '',
      avatarPath: row.author_avatar_path,
      isCreator: row.author_is_creator === true,
    },
    caption: row.caption,
    visibility: (row.visibility as Visibility | null) ?? 'followers',
    publishedAt: row.published_at,
    publishAt: row.publish_at,
    autoPosted: row.auto_posted === true,
    payload: isRecord(row.payload) ? (row.payload as Record<string, Json | undefined>) : {},
    game:
      g && str(g['id'])
        ? {
            id: g['id'] as string,
            sport_id: str(g['sport_id']) ?? 'mlb',
            status: str(g['status']) ?? 'scheduled',
            scheduled_start: str(g['scheduled_start']) ?? '',
            home_team_id: str(g['home_team_id']) ?? '',
            away_team_id: str(g['away_team_id']) ?? '',
            home_name: str(g['home_name']),
            away_name: str(g['away_name']),
            home_abbr: str(g['home_abbr']),
            away_abbr: str(g['away_abbr']),
            home_score: num(g['home_score']),
            away_score: num(g['away_score']),
            winner_team_id: str(g['winner_team_id']),
            is_tie: typeof g['is_tie'] === 'boolean' ? (g['is_tie'] as boolean) : null,
            venue_name: str(g['venue_name']),
            venue_tz: str(g['venue_tz']),
            famous_title: str(g['famous_title']),
          }
        : null,
    result: row.result === 'win' || row.result === 'loss' || row.result === 'tie' ? row.result : null,
    kudosCount: row.kudos_count ?? 0,
    myKudos: row.my_kudos === true,
    commentCount: row.comment_count ?? 0,
    photos: row.photos ?? [],
    reactions: arrayOf(row.reactions, (r) =>
      str(r['id']) && str(r['back_path']) && str(r['front_path'])
        ? {
            id: r['id'] as string,
            back_path: r['back_path'] as string,
            front_path: r['front_path'] as string,
            period_label: str(r['period_label']),
            late_seconds: num(r['late_seconds']),
            captured_at: str(r['captured_at']) ?? '',
          }
        : null,
    ),
    companions: arrayOf(row.companions, (c) =>
      str(c['name']) ? { name: c['name'] as string, handle: str(c['handle']) } : null,
    ),
    community:
      community && str(community['slug']) && str(community['name'])
        ? { slug: community['slug'] as string, name: community['name'] as string }
        : null,
  };
}
