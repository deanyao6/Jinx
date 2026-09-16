import type { StatsPayload } from '@/features/passport/types';

import {
  SUPABASE_BACKED,
  displayRecord,
  lastGameLine,
  nickname,
  passportFromStats,
  passportPillsFromStats,
  streakLine,
  supabaseRepository,
  type PassportInputs,
} from '../supabase';

const PHI = '00000000-0000-0000-0000-0000000000a1';
const PHL = '00000000-0000-0000-0000-0000000000a2';

const stats: StatsPayload = {
  totals: { games: 48, venues: 14, states: 6, countries: 1 },
  overall: { wins: 31, losses: 17, ties: 0 },
  teams: [
    {
      franchise_id: 'mlb-143',
      team_id: PHI,
      name: 'Philadelphia Phillies',
      abbreviation: 'PHI',
      sport_id: 'mlb',
      record: { wins: 12, losses: 5, ties: 0 },
    },
    {
      franchise_id: 'nfl-phi',
      team_id: PHL,
      name: 'Philadelphia Eagles',
      abbreviation: 'PHI',
      sport_id: 'nfl',
      record: { wins: 6, losses: 2, ties: 0 },
    },
  ],
  pledge: { record: { wins: 10, losses: 9, ties: 0 }, vs_expected: 2.4 },
  stamps: [],
  superlatives: {},
  streaks: { longest_win: 5, longest_loss: 2, current: 3 },
  moments: [],
  players_seen: 212,
  computed_at: null,
};

const inputs: PassportInputs = {
  stats,
  teams: new Map([
    [PHI, { id: PHI, name: 'Philadelphia Phillies', city: 'Philadelphia' }],
    [PHL, { id: PHL, name: 'Philadelphia Eagles', city: 'Philadelphia' }],
  ]),
  shapes: new Map(),
  lastGame: 'Last Game: PHI 4 – 2 NYM',
};

describe('Supabase passport mapping', () => {
  it('writes records the way the reference does, with spaces around the dash', () => {
    // packages/core writes "31–17" because that form is also produced server-side and on
    // share cards. The spaced form is a display concern of this design.
    expect(displayRecord({ wins: 31, losses: 17, ties: 0 })).toBe('31 – 17');
    expect(displayRecord({ wins: 6, losses: 2, ties: 1 })).toBe('6 – 2 – 1');
  });

  it('shows a team by its nickname, not its full name', () => {
    expect(nickname('Philadelphia Phillies', 'Philadelphia')).toBe('Phillies');
    expect(nickname('Boston Red Sox', 'Boston')).toBe('Red Sox');
    // A team whose name does not begin with its city is left alone.
    expect(nickname('Texas Rangers', 'Arlington')).toBe('Texas Rangers');
    expect(nickname('Chicago Cubs', null)).toBe('Chicago Cubs');
  });

  it('describes a streak in either direction, and no streak at all', () => {
    expect(streakLine(3)).toBe('+3 game win streak');
    expect(streakLine(-2)).toBe('-2 game losing streak');
    expect(streakLine(0)).toBe('No active streak');
  });

  it('builds the pills from the favourite teams and their game counts', () => {
    const pills = passportPillsFromStats(inputs);
    expect(pills.map((p) => [p.label, p.count])).toEqual([
      ['All Teams', '48'],
      ['Phillies', '17'],
      ['Eagles', '8'],
    ]);
  });

  it('builds the All teams hero from the overall record', () => {
    const p = passportFromStats(inputs, 'all');
    expect(p.label).toBe('LIFETIME RECORD');
    expect(p.badge).toBe('48 GAMES ATTENDED');
    expect(p.record).toBe('31 – 17');
    expect(p.winRate).toBe('.646');
    expect(p.streak).toBe('+3 game win streak');
    expect(p.lastGame).toBe('Last Game: PHI 4 – 2 NYM');
  });

  it('puts the neutral record on the third card, with vs expected', () => {
    const card = passportFromStats(inputs, 'all').cards[2];
    expect(card?.name).toBe('Neutral');
    expect(card?.record).toBe('10 – 9');
    expect(card?.pct).toBe('+2.4 vs exp');
  });

  it('builds a team view from that team record', () => {
    const p = passportFromStats(inputs, PHI);
    expect(p.label).toBe('PHILLIES RECORD');
    expect(p.badge).toBe('17 GAMES ATTENDED');
    expect(p.record).toBe('12 – 5');
    expect(p.winRate).toBe('.706');
    expect(p.teamKey).toBe(PHI);
  });

  it('falls back to the overall view for an unknown pill', () => {
    expect(passportFromStats(inputs, 'not-a-team').label).toBe('LIFETIME RECORD');
  });

  it('says something honest when there are no games yet', () => {
    const empty: PassportInputs = {
      ...inputs,
      lastGame: null,
      stats: {
        ...stats,
        totals: { games: 0, venues: 0, states: 0, countries: 0 },
        overall: { wins: 0, losses: 0, ties: 0 },
      },
    };
    const p = passportFromStats(empty, 'all');
    expect(p.record).toBe('0 – 0');
    expect(p.winRate).toBe('—');
    expect(p.lastGame).toBe('No games logged yet');
  });

  it('builds the Last Game line home team first', () => {
    expect(
      lastGameLine({
        home_score: 4,
        away_score: 2,
        home: { abbreviation: 'PHI' },
        away: { abbreviation: 'NYM' },
      }),
    ).toBe('Last Game: PHI 4 – 2 NYM');
  });

  it('shows no Last Game line rather than one with holes in it', () => {
    // A scheduled game has no score yet, and a game can be missing its team join.
    expect(
      lastGameLine({
        home_score: null,
        away_score: null,
        home: { abbreviation: 'PHI' },
        away: { abbreviation: 'NYM' },
      }),
    ).toBeNull();
    expect(lastGameLine({ home_score: 4, away_score: 2, home: null, away: null })).toBeNull();
  });

  it('is explicit about which methods are real, and falls through for the rest', () => {
    const repo = supabaseRepository(inputs);
    // Backed by the database.
    expect(SUPABASE_BACKED.has('passport')).toBe(true);
    expect(repo.passport('all').record).toBe('31 – 17');
    // Not yet: these still return demo fixtures, and say so rather than looking real.
    expect(SUPABASE_BACKED.has('games')).toBe(false);
    expect(SUPABASE_BACKED.has('relive')).toBe(false);
    expect(repo.games().length).toBeGreaterThan(0);
  });
});
