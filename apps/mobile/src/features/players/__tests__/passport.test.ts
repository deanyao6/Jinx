import { favoritePlayerItems, seenLine, type FavoritePlayerSeenRow } from '../passport';

const PHI = 'team-phi';
const NYM = 'team-nym';

const rows: FavoritePlayerSeenRow[] = [
  // Traded: seen twice as a Phillie, once as a Met.
  {
    player_id: 'p1',
    full_name: 'Traded Slugger',
    sport_id: 'mlb',
    team_id: PHI,
    seen: 2,
    last_seen: '2025-06-01T18:00:00Z',
    last_game_id: 'g2',
  },
  {
    player_id: 'p1',
    full_name: 'Traded Slugger',
    sport_id: 'mlb',
    team_id: NYM,
    seen: 1,
    last_seen: '2025-08-01T18:00:00Z',
    last_game_id: 'g3',
  },
  {
    player_id: 'p2',
    full_name: 'Bryce Harper',
    sport_id: 'mlb',
    team_id: PHI,
    seen: 9,
    last_seen: '2025-09-01T18:00:00Z',
    last_game_id: 'g9',
  },
  {
    player_id: 'p3',
    full_name: 'Aaron Never',
    sport_id: 'mlb',
    team_id: null,
    seen: 0,
    last_seen: null,
    last_game_id: null,
  },
];

const date = (iso: string) => iso.slice(0, 10);

describe('favoritePlayerItems', () => {
  it('adds a traded player up across teams for All teams, and lists the unseen last', () => {
    const items = favoritePlayerItems(rows, 'all', date);
    expect(items.map((i) => [i.name, i.seenLine, i.chip, i.lastGameId])).toEqual([
      ['Bryce Harper', 'Seen 9 times', 'Last 2025-09-01', 'g9'],
      ['Traded Slugger', 'Seen 3 times', 'Last 2025-08-01', 'g3'],
      ['Aaron Never', 'Not seen yet', '', null],
    ]);
  });

  it('counts only games for that team under a team pill, and drops the unseen', () => {
    const items = favoritePlayerItems(rows, PHI, date);
    expect(items.map((i) => [i.name, i.seen, i.lastGameId])).toEqual([
      ['Bryce Harper', 9, 'g9'],
      ['Traded Slugger', 2, 'g2'],
    ]);
  });

  it('shows nothing for a team none of your favourites played for', () => {
    expect(favoritePlayerItems(rows, 'team-dal', date)).toEqual([]);
  });

  it('says once rather than 1 times', () => {
    expect(seenLine(1)).toBe('Seen once');
    expect(seenLine(0)).toBe('Not seen yet');
  });
});
