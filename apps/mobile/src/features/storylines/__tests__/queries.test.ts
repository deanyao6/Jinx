import { storylineCards, storylinesStaleTime, type StorylineRow } from '../queries';

const HOME = 'mets';
const AWAY = 'phillies';

describe('storylineCards', () => {
  const rows: StorylineRow[] = [
    { team_id: HOME, text: 'Mets host the Phillies.', source: 'results' },
    { team_id: null, text: 'Tied 3-3 in their postseason series.', source: 'schedule' },
    { team_id: AWAY, text: 'Phillies visit the Mets.', source: 'results' },
  ];

  it('leads with why the game matters, then away, then home', () => {
    expect(storylineCards(rows, { home: HOME, away: AWAY }).map((c) => c.key)).toEqual([
      'game',
      AWAY,
      HOME,
    ]);
  });

  it('labels each by where its facts came from', () => {
    const cards = storylineCards(rows, { home: HOME, away: AWAY });
    expect(cards[0]?.source).toBe('FROM THE SCHEDULE');
    expect(cards[1]?.source).toBe('FROM RESULTS');
  });

  it('shows an ordinary game with no significance line as just the two teams', () => {
    const ordinary = rows.filter((r) => r.team_id != null);
    expect(storylineCards(ordinary, { home: HOME, away: AWAY }).map((c) => c.key)).toEqual([
      AWAY,
      HOME,
    ]);
  });
});

describe('storylinesStaleTime', () => {
  it('does not hold on to "none yet": the cache is persisted, and they may land in seconds', () => {
    expect(storylinesStaleTime([])).toBeLessThanOrEqual(30_000);
    expect(storylinesStaleTime(undefined)).toBeLessThanOrEqual(30_000);
  });

  it('keeps real storylines for half an hour, inside the pregame refresh', () => {
    expect(storylinesStaleTime([{ text: 'x' }])).toBe(30 * 60_000);
  });
});
