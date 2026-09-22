import { describe, expect, it } from 'vitest';

import {
  firstTouchdowns,
  honorCaption,
  isSuperstarSeason,
  localDateOf,
  matchCuratedGame,
  mlbJoins,
  personalBadgeTitle,
  rosterJoins,
  singularNickname,
  type CuratedFamousGame,
  type MatchableGame,
} from './famous.js';

describe('localDateOf', () => {
  it('reads the date in the venue timezone', () => {
    // 2022 World Series Game 3 at Citizens Bank Park: 00:03 UTC on the 2nd is the 1st in Philadelphia.
    expect(localDateOf('2022-11-02T00:03:00Z', 'America/New_York')).toBe('2022-11-01');
    // Freeman's grand slam: 00:08 UTC on the 26th is the 25th at Dodger Stadium.
    expect(localDateOf('2024-10-26T00:08:00Z', 'America/Los_Angeles')).toBe('2024-10-25');
  });
  it('falls back to Eastern time for a venue without one', () => {
    // Tom Brady's last game, 8:15 pm ET at Raymond James Stadium, no tz on file.
    expect(localDateOf('2023-01-17T01:15:00Z', null)).toBe('2023-01-16');
    expect(localDateOf('2023-01-17T01:15:00Z', '')).toBe('2023-01-16');
  });
  it('keeps an afternoon game on its own day', () => {
    expect(localDateOf('2018-01-21T20:40:00Z', null)).toBe('2018-01-21');
  });
});

describe('matchCuratedGame', () => {
  const game = (over: Partial<MatchableGame>): MatchableGame => ({
    id: 'g1',
    sport_id: 'mlb',
    scheduled_start: '2022-11-02T00:03:00Z',
    venue_tz: 'America/New_York',
    home_abbreviation: 'PHI',
    away_abbreviation: 'HOU',
    doubleheader_number: null,
    ...over,
  });
  const entry: CuratedFamousGame = {
    sport: 'mlb',
    local_date: '2022-11-01',
    home: 'PHI',
    away: 'HOU',
    category: 'record',
    title: 'Five home runs at Citizens Bank Park',
    story: 'World Series Game 3.',
    about: { team: 'PHI' },
  };

  it('finds the game on its local date even when the UTC date is the next day', () => {
    expect(matchCuratedGame(entry, [game({})]).map((g) => g.id)).toEqual(['g1']);
  });
  it('does not match the wrong sides, the wrong sport or the wrong day', () => {
    expect(
      matchCuratedGame(entry, [game({ home_abbreviation: 'HOU', away_abbreviation: 'PHI' })]),
    ).toEqual([]);
    expect(matchCuratedGame(entry, [game({ sport_id: 'nfl' })])).toEqual([]);
    expect(matchCuratedGame(entry, [game({ scheduled_start: '2022-11-03T00:03:00Z' })])).toEqual(
      [],
    );
  });
  it('returns both games of a doubleheader unless the entry says which', () => {
    const dh = [
      game({ id: 'a', scheduled_start: '2022-11-01T17:00:00Z', doubleheader_number: 1 }),
      game({ id: 'b', scheduled_start: '2022-11-01T23:00:00Z', doubleheader_number: 2 }),
    ];
    expect(matchCuratedGame(entry, dh).map((g) => g.id)).toEqual(['a', 'b']);
    expect(matchCuratedGame({ ...entry, game_number: 2 }, dh).map((g) => g.id)).toEqual(['b']);
  });
});

describe('isSuperstarSeason', () => {
  it('counts the honor season and the three after it', () => {
    expect(isSuperstarSeason([2021], 2021)).toBe(true);
    expect(isSuperstarSeason([2021], 2024)).toBe(true);
    expect(isSuperstarSeason([2021], 2025)).toBe(false);
    expect(isSuperstarSeason([2021], 2020)).toBe(false);
    expect(isSuperstarSeason([], 2024)).toBe(false);
  });
});

describe('honorCaption', () => {
  it('puts the season where the honor reads naturally', () => {
    expect(honorCaption({ label: 'MVP', season: 2023, seasonFirst: false })).toBe('MVP 2023');
    expect(honorCaption({ label: 'All-Star', season: 2024, seasonFirst: true })).toBe(
      '2024 All-Star',
    );
  });
});

describe('singularNickname', () => {
  it('turns a plain plural into a singular', () => {
    expect(singularNickname('Phillies')).toBe('Phillie');
    expect(singularNickname('Eagles')).toBe('Eagle');
    expect(singularNickname('Athletics')).toBe('Athletic');
    expect(singularNickname('Blue Jays')).toBe('Blue Jay');
  });
  it('gives up on nicknames with no singular', () => {
    expect(singularNickname('Red Sox')).toBeNull();
    expect(singularNickname('White Sox')).toBeNull();
    expect(singularNickname('Heat')).toBeNull();
  });
});

describe('personalBadgeTitle', () => {
  it('says first days as a Phillie, not first home game', () => {
    expect(
      personalBadgeTitle({
        kind: 'first_days',
        playerName: 'Jhoan Duran',
        teamNickname: 'Phillies',
      }),
    ).toBe('Saw Jhoan Duran’s first days as a Phillie');
    expect(
      personalBadgeTitle({
        kind: 'first_days',
        playerName: 'Saquon Barkley',
        teamNickname: 'Eagles',
      }),
    ).toBe('Saw Saquon Barkley’s first days as an Eagle');
    expect(
      personalBadgeTitle({
        kind: 'first_days',
        playerName: 'Mookie Betts',
        teamNickname: 'Red Sox',
      }),
    ).toBe('Saw Mookie Betts’ first days with the Red Sox');
  });
  it('names the league for a debut, and the other kinds plainly', () => {
    expect(personalBadgeTitle({ kind: 'debut', playerName: 'Bryce Harper', sportId: 'mlb' })).toBe(
      'Saw Bryce Harper’s MLB debut',
    );
    expect(personalBadgeTitle({ kind: 'rookie', playerName: 'Paul Skenes' })).toBe(
      'Saw Paul Skenes’ rookie season',
    );
    expect(personalBadgeTitle({ kind: 'first_td', playerName: 'DeVonta Smith' })).toBe(
      'Saw DeVonta Smith’s first touchdown',
    );
  });
});

describe('firstTouchdowns', () => {
  it('keeps the first game a player scored in and ignores plays with nobody named', () => {
    const firsts = firstTouchdowns([
      { providerGameId: '2021_01_PHI_ATL', scorerProviderId: null, touchdown: true },
      { providerGameId: '2021_01_PHI_ATL', scorerProviderId: '00-0036912', touchdown: true },
      { providerGameId: '2021_01_PHI_ATL', scorerProviderId: '00-0036912', touchdown: false },
      { providerGameId: '2021_02_SF_PHI', scorerProviderId: '00-0036912', touchdown: true },
    ]);
    expect(firsts.get('00-0036912')).toBe('2021_01_PHI_ATL');
    expect(firsts.size).toBe(1);
  });
});

describe('rosterJoins', () => {
  it('finds the week a player first appears on a new team, across seasons', () => {
    const joins = rosterJoins([
      { season: 2024, week: 1, team: 'NYG', gsisId: 'p1' },
      { season: 2024, week: 18, team: 'NYG', gsisId: 'p1' },
      { season: 2025, week: 1, team: 'PHI', gsisId: 'p1' },
      { season: 2025, week: 2, team: 'PHI', gsisId: 'p1' },
      { season: 2025, week: 10, team: 'IND', gsisId: 'p2' },
      { season: 2025, week: 9, team: 'NYJ', gsisId: 'p2' },
    ]);
    expect(joins).toEqual([
      { gsisId: 'p1', team: 'PHI', season: 2025, week: 1 },
      { gsisId: 'p2', team: 'IND', season: 2025, week: 10 },
    ]);
  });
  it('treats a rookie’s first week as a join and an unknown history as nothing', () => {
    expect(
      rosterJoins([{ season: 2021, week: 1, team: 'PHI', gsisId: 'r', rookieSeason: 2021 }]),
    ).toEqual([{ gsisId: 'r', team: 'PHI', season: 2021, week: 1 }]);
    expect(
      rosterJoins([{ season: 2021, week: 1, team: 'PHI', gsisId: 'v', rookieSeason: 2017 }]),
    ).toEqual([]);
  });
});

describe('mlbJoins', () => {
  const mlb = (id: string) => id === '143' || id === '142';
  it('keeps the trade row whose destination is a major league team, once', () => {
    const joins = mlbJoins(
      [
        {
          person: { id: 661395, fullName: 'Jhoan Duran' },
          toTeam: { id: 143 },
          date: '2025-07-30',
          typeCode: 'TR',
        },
        {
          person: { id: 690953, fullName: 'Mick Abel' },
          toTeam: { id: 142 },
          date: '2025-07-30',
          typeCode: 'TR',
        },
        {
          person: { id: 661395, fullName: 'Jhoan Duran' },
          toTeam: { id: 143 },
          date: '2025-08-01',
          typeCode: 'SC',
        },
        {
          person: { id: 605452, fullName: 'Joe Ross' },
          toTeam: { id: 1410 },
          date: '2025-08-01',
          typeCode: 'ASG',
        },
        {
          person: { id: 661395, fullName: 'Jhoan Duran' },
          toTeam: { id: 143 },
          date: '2025-07-30',
          typeCode: 'TR',
        },
      ],
      mlb,
    );
    expect(joins).toEqual([
      {
        providerPlayerId: '661395',
        providerTeamId: '143',
        joinedOn: '2025-07-30',
        kind: 'trade',
        fullName: 'Jhoan Duran',
      },
      {
        providerPlayerId: '690953',
        providerTeamId: '142',
        joinedOn: '2025-07-30',
        kind: 'trade',
        fullName: 'Mick Abel',
      },
    ]);
  });
});
