import { shareGameFor, type ShareableGame } from '../fromGame';

const game: ShareableGame = {
  sport_id: 'nfl',
  status: 'final',
  scheduled_start: '2025-11-28T20:00:00Z',
  home_team_id: 'phi',
  away_team_id: 'chi',
  home_score: 15,
  away_score: 24,
  is_tie: false,
  winner_team_id: 'chi',
  home: { name: 'Philadelphia Eagles' },
  away: { name: 'Chicago Bears' },
  venue: { name: 'Lincoln Financial Field', city: 'Philadelphia' },
};

describe('shareGameFor', () => {
  it('takes the sport from the game, not from the screen it was opened on', () => {
    expect(shareGameFor(game, null).sport).toBe('nfl');
  });

  it("tells it from the user's side, home or away", () => {
    expect(shareGameFor(game, { rooting_team_id: 'chi', verified: true })).toMatchObject({
      side: 'Chicago Bears',
      result: 'win',
      verified: true,
    });
    expect(shareGameFor(game, { rooting_team_id: 'phi', verified: false })).toMatchObject({
      side: 'Philadelphia Eagles',
      result: 'loss',
      verified: false,
    });
  });

  it('claims no side and no result for a neutral game with no pick', () => {
    expect(shareGameFor(game, { rooting_team_id: null, verified: false })).toMatchObject({
      side: null,
      result: null,
    });
  });

  it('knows a tie', () => {
    const tie = { ...game, home_score: 20, away_score: 20, is_tie: true, winner_team_id: null };
    expect(shareGameFor(tie, { rooting_team_id: 'phi', verified: false }).result).toBe('tie');
  });

  it('gives no result before the game is final', () => {
    const live = { ...game, status: 'live' };
    expect(shareGameFor(live, { rooting_team_id: 'chi', verified: true }).result).toBeNull();
  });

  it('writes the venue with its city, or without when there is none', () => {
    expect(shareGameFor(game, null).venue).toBe('Lincoln Financial Field, Philadelphia');
    expect(shareGameFor({ ...game, venue: { name: 'Wembley' } }, null).venue).toBe('Wembley');
    expect(shareGameFor({ ...game, venue: null }, null).venue).toBeNull();
  });
});

describe('MLS share results', () => {
  const mls = { ...game, sport_id: 'mls', home_score: 3, away_score: 3, winner_team_id: 'phi' };
  it('counts a single-match shootout winner without adding penalties to goals', () => {
    expect(shareGameFor(mls, { rooting_team_id: 'phi', verified: false })).toMatchObject({
      result: 'win',
      homeScore: 3,
      awayScore: 3,
      sport: 'mls',
      winner: 'home',
    });
    expect(shareGameFor(mls, { rooting_team_id: 'chi', verified: false }).result).toBe('loss');
  });
  it('uses the individual match winner supplied for a two-leg playoff', () => {
    expect(
      shareGameFor(
        { ...mls, home_score: 0, away_score: 1, winner_team_id: 'chi' },
        { rooting_team_id: 'phi', verified: false },
      ).result,
    ).toBe('loss');
  });
  it('preserves draws', () => {
    expect(
      shareGameFor(
        { ...mls, winner_team_id: null, is_tie: true },
        { rooting_team_id: 'phi', verified: false },
      ).result,
    ).toBe('tie');
  });
});
