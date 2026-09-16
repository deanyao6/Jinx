import type { StatsPayload } from '@/features/passport/types';

import {
  SUPABASE_BACKED,
  displayRecord,
  lastGameLine,
  nickname,
  passportFromStats,
  passportPillsFromStats,
  companionLine,
  companionTone,
  friendsFromRecords,
  gameRowFromAttendance,
  overlapLine,
  togetherLine,
  listSentence,
  pickASideFromContext,
  reliveFromGame,
  storylineSource,
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
    [PHI, { id: PHI, name: 'Philadelphia Phillies', city: 'Philadelphia', abbreviation: 'PHI' }],
    [PHL, { id: PHL, name: 'Philadelphia Eagles', city: 'Philadelphia', abbreviation: 'PHI' }],
  ]),
  shapes: new Map(),
  lastGameId: 'game-1',
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
    expect(SUPABASE_BACKED.has('games')).toBe(true);
    expect(repo.passport('all').record).toBe('31 – 17');
    // Backed, and this user has no attendances, so the list is genuinely empty rather
    // than quietly falling back to the fixtures.
    expect(repo.games()).toEqual([]);
    // Not yet backed: these still return demo fixtures, which the Plan and Guide shells
    // need in v1 anyway.
    expect(SUPABASE_BACKED.has('friends')).toBe(true);
    // Per-game methods are deliberately absent: they need a game id, which this
    // repository has no way to supply. See the note on the Repository type.
    expect(SUPABASE_BACKED.has('pickASide')).toBe(false);
    expect(SUPABASE_BACKED.has('relive')).toBe(false);
    expect(SUPABASE_BACKED.has('guide')).toBe(false);
    expect(repo.guideRows('food').length).toBeGreaterThan(0);
  });
});

describe('Relive mapping', () => {
  const game = {
    scheduled_start: '2025-08-14T23:05:00Z',
    home: { abbreviation: 'PHI', name: 'Philadelphia Phillies', id: PHI },
    away: { abbreviation: 'NYM', name: 'New York Mets', id: 'nym-id' },
    venue: { name: 'Citizens Bank Park' },
  };

  it('builds the scorebug from the game', () => {
    const r = reliveFromGame(game);
    expect(r.away.badge).toBe('NYM');
    expect(r.home.badge).toBe('PHI');
    // The theme key is the team id, so the badges take that team's real palette.
    expect(r.home.team).toBe(PHI);
  });

  it('builds the note from what it actually has', () => {
    expect(reliveFromGame(game, { seat: '321', companions: ['Dad', 'Maya'] }).note).toBe(
      'Aug 14, 2025, Citizens Bank Park, Section 321 with Dad and Maya',
    );
    // No seat and no companions: the clause is left out, not rendered empty.
    expect(reliveFromGame(game).note).toBe('Aug 14, 2025, Citizens Bank Park');
    expect(reliveFromGame(game, { companions: ['Dad'] }).note).toBe(
      'Aug 14, 2025, Citizens Bank Park, With Dad',
    );
  });

  it('joins names the way the reference writes them', () => {
    expect(listSentence([])).toBe('');
    expect(listSentence(['Dad'])).toBe('Dad');
    expect(listSentence(['Dad', 'Maya'])).toBe('Dad and Maya');
    expect(listSentence(['Dad', 'Maya', 'Sam'])).toBe('Dad, Maya and Sam');
  });

  it('survives a game with its team joins missing', () => {
    const r = reliveFromGame({ ...game, home: null, away: null, venue: null });
    expect(r.home.badge).toBe('—');
    expect(r.note).toBe('Aug 14, 2025');
  });
});

describe('Games history mapping', () => {
  const shapes = new Map<'ballparkA' | 'dodger', never>() as unknown as ReadonlyMap<
    string,
    'ballparkA'
  >;

  const base = {
    rooting_team_id: PHI,
    game: {
      id: 'g1',
      status: 'final',
      scheduled_start: '2024-10-12T23:05:00Z',
      home_team_id: PHI,
      away_team_id: 'nym-id',
      home_score: 5,
      away_score: 3,
      home: { id: PHI, name: 'Philadelphia Phillies', abbreviation: 'PHI' },
      away: { id: 'nym-id', name: 'New York Mets', abbreviation: 'NYM' },
      venue: { id: 'v1', name: 'Citizens Bank Park', city: 'Philadelphia' },
    },
    companions: [
      { person: { id: 'p1', display_name: 'Alex' } },
      { person: { id: 'p2', display_name: 'Marcus' } },
    ],
  };

  const teamRefs = new Map([
    [PHI, { id: PHI, name: 'Philadelphia Phillies', city: 'Philadelphia', abbreviation: 'PHI' }],
    ['nym-id', { id: 'nym-id', name: 'New York Mets', city: 'New York', abbreviation: 'NYM' }],
  ]);

  it('writes the matchup away team first, as the reference does', () => {
    const row = gameRowFromAttendance(base, shapes, teamRefs);
    expect(row?.title).toBe('Mets 3, Phillies 5');
    expect(row?.meta).toBe('Citizens Bank Park, Oct 12, 2024');
  });

  it('takes the home team colours, even for an away game', () => {
    // The thumbnail is a picture of that stadium, so the row is the home team's colour.
    const away = {
      ...base,
      game: {
        ...base.game,
        home_team_id: 'lad',
        home: { id: 'lad', name: 'Los Angeles Dodgers', abbreviation: 'LAD' },
      },
    };
    expect(gameRowFromAttendance(away, shapes, teamRefs)?.team).toBe('lad');
  });

  it('shows the result from the side you were rooting for', () => {
    expect(gameRowFromAttendance(base, shapes, teamRefs)?.result).toBe('w');
    // Same game, rooting for the Mets.
    const mets = { ...base, rooting_team_id: 'nym-id' };
    expect(gameRowFromAttendance(mets, shapes, teamRefs)?.result).toBe('l');
  });

  it('omits the circle rather than calling a tie a loss', () => {
    const tied = { ...base, game: { ...base.game, home_score: 3, away_score: 3 } };
    expect(gameRowFromAttendance(tied, shapes, teamRefs)?.result).toBeNull();
    // And for a game with no rooting side at all.
    const neutral = { ...base, rooting_team_id: null };
    expect(gameRowFromAttendance(neutral, shapes, teamRefs)?.result).toBeNull();
  });

  it('handles a game that has not been played yet', () => {
    const upcoming = {
      ...base,
      game: { ...base.game, status: 'scheduled', home_score: null, away_score: null },
    };
    const row = gameRowFromAttendance(upcoming, shapes, teamRefs);
    expect(row?.title).toBe('Mets at Phillies');
    expect(row?.result).toBeNull();
  });

  it('abbreviates the companion line the way the reference does', () => {
    expect(companionLine([])).toBe('');
    expect(companionLine(['Alex', 'Marcus'])).toBe('w/ Alex, Marcus');
    expect(companionLine(['Chloe', 'David', 'Sam'])).toBe('w/ Chloe, David +1');
  });

  it('drops a row whose team joins are missing rather than rendering a blank', () => {
    expect(
      gameRowFromAttendance({ ...base, game: { ...base.game, home: null } }, shapes, teamRefs),
    ).toBeNull();
  });
});

describe('Pick a side mapping', () => {
  const teamRefs = new Map([
    ['nym-id', { id: 'nym-id', name: 'New York Mets', city: 'New York', abbreviation: 'NYM' }],
    ['sd-id', { id: 'sd-id', name: 'San Diego Padres', city: 'San Diego', abbreviation: 'SD' }],
  ]);

  const ctx = {
    sport_id: 'mlb',
    venue: { name: 'Petco Park' },
    away: { team_id: 'nym-id', name: 'New York Mets', win_prob: 0.58 },
    home: { team_id: 'sd-id', name: 'San Diego Padres', win_prob: 0.42 },
    pledge: null,
  };

  it('builds both sides from the game context', () => {
    const p = pickASideFromContext(ctx, teamRefs, [], '12:34');
    expect(p.venue).toBe('At Petco Park');
    expect(p.lockCountdown).toBe('12:34');
    expect(p.away.badge).toBe('NYM');
    expect(p.away.name).toBe('Mets');
    expect(p.away.button).toBe('Root for NYM Mets');
    expect(p.home.winProb).toBe(0.42);
  });

  it('says something rather than nothing when the venue is unknown', () => {
    expect(
      pickASideFromContext({ ...ctx, venue: { name: null } }, teamRefs, [], '0:00').venue,
    ).toBe('At the game');
  });

  it('falls back to even odds rather than rendering a broken bar', () => {
    const noProb = { ...ctx, away: { ...ctx.away, win_prob: null } };
    expect(pickASideFromContext(noProb, teamRefs, [], '1:00').away.winProb).toBe(0.5);
  });

  it('labels storyline sources the way the reference does', () => {
    expect(storylineSource('results')).toBe('FROM RESULTS');
    expect(storylineSource('probable_starter')).toBe('PROBABLE STARTERS');
    expect(storylineSource('injury_report')).toBe('OFFICIAL INJURY REPORT');
    // An unknown source is still shown rather than dropped.
    expect(storylineSource('something_new')).toBe('SOMETHING NEW');
  });

  it('shows no storylines rather than placeholder ones when there are none', () => {
    // Storyline generation is blocked on the Anthropic key, so this is the real state.
    expect(pickASideFromContext(ctx, teamRefs, [], '1:00').storylines).toEqual([]);
  });

  it('carries storylines through with their labels', () => {
    const p = pickASideFromContext(
      ctx,
      teamRefs,
      [{ team_id: 'nym-id', text: 'Mets have won four straight.', source: 'results' }],
      '1:00',
    );
    expect(p.storylines).toEqual([
      { text: 'Mets have won four straight.', source: 'FROM RESULTS' },
    ]);
  });
});

describe('Friends mapping', () => {
  const companions = [
    { person_id: 'p1', display_name: 'Dad', games: 11, wins: 7, losses: 1, ties: 0 },
    { person_id: 'p2', display_name: 'Maya Chen', games: 6, wins: 4, losses: 2, ties: 0 },
    { person_id: 'p3', display_name: 'Priya Nair', games: 4, wins: 3, losses: 1, ties: 0 },
    { person_id: 'p4', display_name: 'Jordan Ellis', games: 4, wins: 0, losses: 4, ties: 0 },
  ];

  it('colours the records the way the reference does', () => {
    // 7-1 green, 0-4 red, and both 4-2 and 3-1 plain ink: it is not simply win or lose.
    const f = friendsFromRecords(companions, [], []);
    expect(f.people.map((p) => p.tone)).toEqual(['good', 'ink', 'ink', 'bad']);
    expect(f.people[0]?.record).toBe('7–1');
    expect(f.people[0]?.sub).toBe('11 games together');
  });

  it('gets the singular right for one game', () => {
    expect(togetherLine(1)).toBe('1 game together');
    expect(togetherLine(11)).toBe('11 games together');
  });

  it('treats a record with no decided games as neutral, not as a loss', () => {
    expect(companionTone({ wins: 0, losses: 0, ties: 3 })).toBe('ink');
  });

  it('builds the rivalry card from the first rivalry', () => {
    const f = friendsFromRecords(
      companions,
      [{ rival_display_name: 'Jordan', rival_teams: ['Mets'], my_wins: 5, rival_wins: 3 }],
      [],
    );
    expect(f.rivalry?.label).toBe('Rivalry with Jordan, Mets fan');
    expect(f.rivalry?.you.score).toBe('5');
    expect(f.rivalry?.them.score).toBe('3');
  });

  it('omits the rivalry and overlap cards when there are none', () => {
    const f = friendsFromRecords(companions, [], []);
    expect(f.rivalry).toBeNull();
    expect(f.overlap).toBeNull();
  });

  it('prefers an overlap that really was before you connected', () => {
    const after = {
      other_display_name: 'Sam',
      home_team_name: 'Phillies',
      away_team_name: 'Mets',
      scheduled_start: '2023-05-01T00:00:00Z',
      section_gap: 2,
      before_connected: false,
    };
    const before = { ...after, other_display_name: 'Maya', before_connected: true };
    const f = friendsFromRecords(companions, [], [after, before]);
    expect(f.overlap?.text).toContain('You and Maya');
  });

  it('leaves the section gap out when it is unknown', () => {
    const o = {
      other_display_name: 'Maya',
      home_team_name: 'Phillies',
      away_team_name: 'Mets',
      scheduled_start: '2019-08-14T23:00:00Z',
      section_gap: null,
      before_connected: true,
    };
    expect(overlapLine(o)).toBe('You and Maya were both at Phillies vs Mets in August 2019.');
    expect(overlapLine({ ...o, section_gap: 11 })).toBe(
      'You and Maya were both at Phillies vs Mets in August 2019, 11 sections apart.',
    );
  });
});
