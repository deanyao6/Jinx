import type { Post, PostGame } from './types';

/**
 * The feed in demo mode (`EXPO_PUBLIC_DEMO`, SPEC.md 8.9): one post of every kind, drawn from
 * the people and games in `design/prototype.html`, so the cards can be seen and screenshotted
 * without an account full of friends. A real user never sees these.
 *
 * Team ids are the reference's short keys ('phi', 'nym'), which `TeamTheme` resolves in demo
 * mode. Photo paths starting `demo:` draw the reference's placeholder scenes.
 */

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

function game(partial: Partial<PostGame> & Pick<PostGame, 'id'>): PostGame {
  return {
    sport_id: 'mlb',
    status: 'final',
    scheduled_start: hoursAgo(20),
    home_team_id: 'nym',
    away_team_id: 'phi',
    home_name: 'Mets',
    away_name: 'Phillies',
    home_abbr: 'NYM',
    away_abbr: 'PHI',
    home_score: 2,
    away_score: 7,
    winner_team_id: 'phi',
    is_tie: false,
    venue_name: 'Citi Field',
    venue_tz: 'America/New_York',
    famous_title: null,
    ...partial,
  };
}

const citi = game({ id: 'demo-g1' });
const linc = game({
  id: 'demo-g2',
  sport_id: 'nfl',
  home_team_id: 'phl',
  away_team_id: 'nyg',
  home_name: 'Eagles',
  away_name: 'Giants',
  home_abbr: 'PHI',
  away_abbr: 'NYG',
  home_score: 24,
  away_score: 20,
  winner_team_id: 'phl',
  venue_name: 'Lincoln Financial Field',
  scheduled_start: hoursAgo(30),
});

const people = {
  maya: { id: 'demo-maya', handle: 'mayachen', displayName: 'Maya Chen', avatarPath: null, isCreator: false },
  philly: { id: 'demo-philly', handle: 'phillyphaithful', displayName: 'Philly Phaithful', avatarPath: null, isCreator: true },
  jordan: { id: 'demo-jordan', handle: 'jordanb', displayName: 'Jordan Blake', avatarPath: null, isCreator: false },
  dad: { id: 'demo-dad', handle: 'bigdave', displayName: 'Dave Yao', avatarPath: null, isCreator: false },
  sam: { id: 'demo-sam', handle: 'samruiz', displayName: 'Sam Ruiz', avatarPath: null, isCreator: false },
};

const base = {
  visibility: 'followers' as const,
  publishAt: null,
  autoPosted: false,
  payload: {},
  game: null,
  result: null,
  kudosCount: 0,
  myKudos: false,
  commentCount: 0,
  photos: [],
  reactions: [],
  companions: [],
  community: null,
  caption: null,
};

export const DEMO_POSTS: readonly Post[] = [
  {
    ...base,
    id: 'demo-p1',
    kind: 'reaction',
    author: people.maya,
    publishedAt: hoursAgo(19),
    game: citi,
    reactions: [
      {
        id: 'demo-r1',
        back_path: 'demo:field:1',
        front_path: 'demo:selfie:2',
        period_label: '3rd inning',
        late_seconds: 12,
        captured_at: hoursAgo(19),
      },
    ],
    kudosCount: 18,
    commentCount: 2,
  },
  {
    ...base,
    id: 'demo-p2',
    kind: 'game',
    author: people.maya,
    publishedAt: hoursAgo(17),
    autoPosted: true,
    game: citi,
    result: 'win',
    caption: 'Harper in the 3rd and the Mets never recovered. 300 level was the right call.',
    photos: ['demo:selfie:0', 'demo:field:1', 'demo:board:2'],
    reactions: [
      {
        id: 'demo-r1',
        back_path: 'demo:field:1',
        front_path: 'demo:selfie:2',
        period_label: '3rd inning',
        late_seconds: 12,
        captured_at: hoursAgo(19),
      },
    ],
    companions: [
      { name: 'Dad', handle: null },
      { name: 'Jordan Blake', handle: 'jordanb' },
    ],
    kudosCount: 31,
    myKudos: true,
    commentCount: 4,
  },
  {
    ...base,
    id: 'demo-p3',
    kind: 'stamp',
    author: people.jordan,
    publishedAt: hoursAgo(2),
    payload: { venue_name: 'Wrigley Field' },
    kudosCount: 6,
  },
  {
    ...base,
    id: 'demo-p4',
    kind: 'game',
    author: people.philly,
    visibility: 'public',
    publishedAt: hoursAgo(28),
    game: linc,
    result: 'win',
    caption: 'Sixth straight home win. The Linc was shaking in the fourth.',
    photos: ['demo:board:1'],
    kudosCount: 412,
    commentCount: 37,
  },
  {
    ...base,
    id: 'demo-p5',
    kind: 'milestone',
    author: people.dad,
    publishedAt: hoursAgo(26),
    payload: { games: 50 },
    kudosCount: 22,
    commentCount: 5,
  },
  {
    ...base,
    id: 'demo-p6',
    kind: 'goal',
    author: people.sam,
    publishedAt: hoursAgo(40),
    payload: { title: 'Every NL West park' },
    kudosCount: 9,
  },
  {
    ...base,
    id: 'demo-p7',
    kind: 'wrapped',
    author: people.maya,
    publishedAt: hoursAgo(60),
    payload: { sport_id: 'mlb', season: 2026 },
    kudosCount: 14,
    commentCount: 1,
  },
  {
    ...base,
    id: 'demo-p8',
    kind: 'badge',
    author: people.jordan,
    publishedAt: hoursAgo(72),
    payload: { badge_key: 'walk_off', name: 'Walk-off witnessed', tier: 'silver' },
    kudosCount: 5,
  },
];

export const DEMO_COMMENTS = [
  { id: 'demo-c1', author: people.dad, body: 'Great seats. Told you the 300 level was fine.', mine: false },
  { id: 'demo-c2', author: people.jordan, body: 'You jinxed the Mets and I respect it.', mine: false },
  { id: 'demo-c3', author: people.sam, body: 'Was there too, section 320. Did not see you.', mine: false },
];

export const DEMO_DISCOVER = {
  creators: [
    { ...people.philly, note: 'Phillies since 1996, 118 games logged', followers: 48210 },
    { ...people.sam, isCreator: true, note: 'Every NL West park, twice', followers: 3120 },
  ],
  fans: [{ ...people.sam, sharedGames: 3, lastGame: 'Padres at Dodgers, Sep 18' }],
};
