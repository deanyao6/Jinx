import { seasonRecord, type RecordGame } from '../records';

const game = (home: string, away: string, hs: number | null, as: number | null): RecordGame => ({
  home_team_id: home,
  away_team_id: away,
  home_score: hs,
  away_score: as,
});

describe('seasonRecord', () => {
  const games = [
    game('PHI', 'NYM', 5, 3), // PHI home win
    game('NYM', 'PHI', 2, 4), // PHI road win
    game('PHI', 'ATL', 1, 6), // PHI home loss
    game('ATL', 'NYM', 3, 2), // not PHI
  ];

  it('counts home and road games from the team side', () => {
    expect(seasonRecord(games, 'PHI')).toBe('2–1');
    expect(seasonRecord(games, 'NYM')).toBe('0–3');
    expect(seasonRecord(games, 'ATL')).toBe('2–0');
  });

  it('adds the tie column only once there is a tie', () => {
    expect(seasonRecord([...games, game('PHI', 'DAL', 20, 20)], 'PHI')).toBe('2–1–1');
  });

  it('ignores a game with no score', () => {
    expect(seasonRecord([game('PHI', 'NYM', null, null)], 'PHI')).toBe('');
  });

  it('is empty before opening day rather than 0 and 0', () => {
    expect(seasonRecord([], 'PHI')).toBe('');
  });
});
