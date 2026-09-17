import {
  EMPTY_STATS,
  comebackValue,
  gameContext,
  isEmptyStats,
  parseStats,
  possessive,
  superlativeLabel,
  superlativeRows,
  totalsLine,
} from '../format';

const payload = {
  totals: { games: 48, venues: 14, states: 3, countries: 1 },
  overall: { wins: 31, losses: 17, ties: 0 },
  teams: [
    {
      franchise_id: 'mlb-143',
      team_id: 't1',
      name: 'Philadelphia Phillies',
      abbreviation: 'PHI',
      sport_id: 'mlb',
      record: { wins: 12, losses: 5, ties: 0 },
    },
  ],
  pledge: { record: { wins: 10, losses: 9, ties: 0 }, vs_expected: 2.4 },
  stamps: [
    {
      venue_id: 'v1',
      name: 'Citizens Bank Park',
      city: 'Philadelphia',
      state: 'PA',
      country: 'USA',
      visits: 17,
      first_visit: '2015-04-06T17:05:00+00:00',
      sports: ['mlb'],
      closed: false,
      lat: 39.9,
      lng: -75.16,
    },
    { venue_id: 'bad' },
  ],
  superlatives: {
    coldest: { game_id: 'g1', value: 19 },
    biggest_comeback: { game_id: 'g2', deficit: 17 },
    most_seen_player: { player_id: 'p1', name: 'Bryce Harper', count: 14 },
    farthest_venue: { venue_id: 'v9', name: 'Dodger Stadium', km: 3860 },
  },
  streaks: { longest_win: 5, longest_loss: 2, current: 1 },
  moments: [
    { type: 'walk_off', count: 2 },
    { type: 'home_run', count: 40 },
  ],
  players_seen: 312,
  computed_at: '2026-09-15T00:00:00Z',
};

describe('parseStats', () => {
  it('normalizes a full payload and drops malformed stamps', () => {
    const s = parseStats(payload);
    expect(s.totals.games).toBe(48);
    expect(s.overall).toEqual({ wins: 31, losses: 17, ties: 0 });
    expect(s.teams[0]?.record.wins).toBe(12);
    expect(s.pledge.vs_expected).toBe(2.4);
    expect(s.stamps).toHaveLength(1);
    expect(s.stamps[0]?.visits).toBe(17);
    expect(s.players_seen).toBe(312);
    expect(isEmptyStats(s)).toBe(false);
  });

  it('tolerates null superlatives and missing keys on a fresh account', () => {
    const s = parseStats({ totals: { games: 0 }, superlatives: null, moments: null });
    expect(s).toEqual(EMPTY_STATS);
    expect(isEmptyStats(s)).toBe(true);
    expect(superlativeRows(s.superlatives, s.moments, s.streaks)).toEqual([]);
  });
});

describe('display helpers', () => {
  it('formats the totals line and the possessive header', () => {
    expect(totalsLine(parseStats(payload).totals)).toBe('48 games, 14 stadiums, 3 states');
    expect(totalsLine({ games: 1, venues: 1, states: 1, countries: 2 })).toBe(
      '1 game, 1 stadium, 1 state, 2 countries',
    );
    expect(possessive('Dean')).toBe('Dean’s');
    expect(possessive('Charles')).toBe('Charles’');
  });

  it('orders superlative rows with the most interesting first, and links games', () => {
    const s = parseStats(payload);
    const rows = superlativeRows(s.superlatives, s.moments, s.streaks);
    expect(rows.map((r) => [r.title, r.value])).toEqual([
      ['Biggest comeback', 'Down 17'],
      ['Coldest game', '19°F'],
      ['Farthest from home', '2,398 mi'],
      ['Walk-offs witnessed', '2'],
      ['Longest win streak', '5 games'],
      ['Longest losing streak', '2 games'],
    ]);
    expect(rows.find((r) => r.key === 'coldest')?.gameId).toBe('g1');
    expect(rows.find((r) => r.key === 'farthest_venue')?.context).toBe('Dodger Stadium');
  });

  it('never shows the overall most seen player, who is usually a stranger', () => {
    const rows = superlativeRows({
      most_seen_player: { player_id: 'p9', name: 'Carl Jones', count: 30 },
    });
    expect(rows).toEqual([]);
  });

  it('leads with the favourite player seen most, and points the row at that player', () => {
    const rows = superlativeRows({
      coldest: { game_id: 'g1', value: 19 },
      most_seen_player: { player_id: 'p9', name: 'Carl Jones', count: 30 },
      most_seen_favorite_player: { player_id: 'p1', name: 'Bryce Harper', count: 14 },
    });
    expect(rows[0]).toEqual({
      key: 'most_seen_favorite_player',
      title: 'Seen Bryce Harper play',
      value: '14 times',
      playerId: 'p1',
    });
    expect(
      superlativeRows({ most_seen_favorite_player: { player_id: 'p1', name: 'Kyle', count: 1 } })[0]
        ?.value,
    ).toBe('1 time');
  });

  it('puts every row in the agreed order', () => {
    const rows = superlativeRows(
      {
        first_game: { game_id: 'g0', date: '2015-04-06T17:05:00+00:00' },
        most_visited_venue: { venue_id: 'v1', name: 'Citizens Bank Park', visits: 17 },
        lowest_scoring: { game_id: 'g8', total: 1 },
        highest_scoring: { game_id: 'g7', total: 25 },
        longest: { game_id: 'g6', minutes: 281, periods: 13 },
        farthest_venue: { venue_id: 'v9', name: 'Dodger Stadium', km: 3860 },
        highest_altitude: { venue_id: 'v5', name: 'Coors Field', elevation_ft: 5180 },
        largest_crowd: { game_id: 'g5', attendance: 34104 },
        hottest: { game_id: 'g4', value: 98 },
        coldest: { game_id: 'g1', value: 19 },
        biggest_comeback: { game_id: 'g2', deficit: 4, sport_id: 'mlb', low_win_prob: 0.04 },
        most_seen_favorite_player: { player_id: 'p1', name: 'Bryce Harper', count: 14 },
      },
      [],
      { longest_win: 5, longest_loss: 0, current: 1 },
    );
    expect(rows.map((r) => r.key)).toEqual([
      'most_seen_favorite_player',
      'biggest_comeback',
      'coldest',
      'hottest',
      'largest_crowd',
      'highest_altitude',
      'farthest_venue',
      'longest',
      'highest_scoring',
      'lowest_scoring',
      'longest_win',
      'most_visited_venue',
      'first_game',
    ]);
  });

  describe('biggest comeback', () => {
    const row = (c: NonNullable<Parameters<typeof comebackValue>[0]>) =>
      superlativeRows({ biggest_comeback: c })[0];

    it('is a win probability when the game has a timeline', () => {
      const r = row({ game_id: 'g2', deficit: 4, sport_id: 'mlb', low_win_prob: 0.0412 });
      expect(r).toMatchObject({
        title: 'Biggest comeback',
        value: 'Won from 4%',
        detail: 'win probability',
        gameId: 'g2',
      });
      expect(superlativeLabel(r!)).toBe('Biggest comeback, win probability');
    });

    it('does not claim 0% for a game that was won', () => {
      expect(row({ game_id: 'g2', deficit: 15, sport_id: 'nfl', low_win_prob: 0.002 })?.value).toBe(
        'Won from under 1%',
      );
    });

    it('words the deficit by sport when there is no timeline', () => {
      expect(row({ game_id: 'g2', deficit: 4, sport_id: 'mlb' })?.value).toBe('Down 4 runs');
      expect(row({ game_id: 'g2', deficit: 1, sport_id: 'mlb' })?.value).toBe('Down 1 run');
      expect(row({ game_id: 'g2', deficit: 14, sport_id: 'nfl' })?.value).toBe('Down 14 points');
      expect(row({ game_id: 'g2', deficit: 9, sport_id: 'nba' })?.value).toBe('Down 9');
      // A payload cached before superlatives v2 has no sport at all.
      expect(row({ game_id: 'g2', deficit: 17 })?.value).toBe('Down 17');
      expect(row({ game_id: 'g2', deficit: 17 })?.detail).toBeUndefined();
    });
  });

  it('formats the new rows: crowd, altitude, farthest', () => {
    const rows = superlativeRows({
      largest_crowd: { game_id: 'g5', attendance: 34104 },
      highest_altitude: { venue_id: 'v5', name: 'Coors Field', elevation_ft: 5180, game_id: 'g3' },
      farthest_venue: { venue_id: 'v9', name: 'Dodger Stadium', km: 3860, game_id: 'g4' },
      most_visited_venue: { venue_id: 'v1', name: 'Citizens Bank Park', visits: 17, game_id: 'g6' },
    });
    expect(rows).toEqual([
      { key: 'largest_crowd', title: 'Largest crowd', value: '34,104', gameId: 'g5' },
      {
        key: 'highest_altitude',
        title: 'Highest altitude',
        value: '5,180 ft',
        context: 'Coors Field',
        gameId: 'g3',
        venueId: 'v5',
      },
      {
        key: 'farthest_venue',
        title: 'Farthest from home',
        value: '2,398 mi',
        context: 'Dodger Stadium',
        gameId: 'g4',
        venueId: 'v9',
      },
      {
        key: 'most_visited_venue',
        title: 'Most visited stadium',
        value: '17 visits',
        context: 'Citizens Bank Park',
        gameId: 'g6',
        venueId: 'v1',
      },
    ]);
  });

  it('says one game once when it is both the coldest and the hottest', () => {
    const rows = superlativeRows({
      coldest: { game_id: 'g1', value: 60 },
      hottest: { game_id: 'g1', value: 60 },
      highest_scoring: { game_id: 'g1', total: 7 },
      lowest_scoring: { game_id: 'g1', total: 7 },
    });
    expect(rows.map((r) => r.key)).toEqual(['coldest', 'highest_scoring']);
  });

  it('gives game rows a context chip from the games it is handed', () => {
    const games = new Map([
      ['g1', { scheduled_start: '2024-01-15T18:00:00Z', away: 'DAL', home: 'PHI' }],
      ['g0', { scheduled_start: '2015-04-15T17:05:00Z', away: 'NYM', home: 'PHI' }],
    ]);
    const rows = superlativeRows(
      {
        coldest: { game_id: 'g1', value: 19 },
        largest_crowd: { game_id: 'missing', attendance: 100 },
        first_game: { game_id: 'g0', date: '2015-04-15T17:05:00Z' },
      },
      [],
      undefined,
      (id) => games.get(id),
    );
    expect(rows.find((r) => r.key === 'coldest')?.context).toBe('DAL at PHI, Jan 2024');
    // The value is already the date.
    expect(rows.find((r) => r.key === 'first_game')?.context).toBe('NYM at PHI');
    expect(rows.find((r) => r.key === 'largest_crowd')?.context).toBeUndefined();
    expect(gameContext({ scheduled_start: '2024-01-15T18:00:00Z', away: null, home: 'PHI' })).toBe(
      'Jan 2024',
    );
  });
});
