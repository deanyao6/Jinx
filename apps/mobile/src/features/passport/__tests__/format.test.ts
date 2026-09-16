import {
  EMPTY_STATS,
  isEmptyStats,
  parseStats,
  possessive,
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

  it('orders superlative rows like the mockup and links games', () => {
    const s = parseStats(payload);
    const rows = superlativeRows(s.superlatives, s.moments, s.streaks);
    expect(rows.slice(0, 4).map((r) => [r.title, r.value])).toEqual([
      ['Seen Bryce Harper play', '14 times'],
      ['Walk-offs witnessed', '2'],
      ['Coldest game', '19°F'],
      ['Biggest comeback', 'Down 17'],
    ]);
    expect(rows.find((r) => r.key === 'coldest')?.gameId).toBe('g1');
    expect(rows.find((r) => r.key === 'farthest_venue')?.value).toBe('2,398 mi');
    expect(rows.find((r) => r.key === 'longest_win')?.value).toBe('5 games');
  });
});
