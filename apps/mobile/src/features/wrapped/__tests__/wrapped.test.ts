import { wrappedCardCopy } from '../copy';
import { parseWrapped } from '../parse';
import { currentSeasonFor, isPreviewSeason, seasonOptions } from '../seasons';

const payload = {
  sport_id: 'mlb',
  season: 2026,
  generated_at: '2026-09-15T00:00:00Z',
  cards: [
    { kind: 'games', games: 12 },
    {
      kind: 'record',
      record: { wins: 8, losses: 4, ties: 0 },
      teams: [
        { team_id: 't1', name: 'Philadelphia Phillies', record: { wins: 6, losses: 2, ties: 0 } },
      ],
    },
    { kind: 'pledge', pledge: { record: { wins: 0, losses: 0, ties: 0 }, vs_expected: 0 } },
    { kind: 'stamps', stamps: { venues: 3, new: [{ venue_id: 'v1', name: 'Wrigley Field' }] } },
    { kind: 'player', player: { player_id: 'p1', name: 'Bryce Harper', count: 9 } },
    {
      kind: 'moment',
      moment: {
        type: 'walk_off_home_run',
        game_id: 'g1',
        player: 'Kyle Schwarber',
        occurred_at: null,
      },
    },
    {
      kind: 'companions',
      best: { person_id: 'a', name: 'Dad', record: { wins: 4, losses: 1, ties: 0 } },
      worst: { person_id: 'b', name: 'Sam', record: { wins: 1, losses: 3, ties: 0 } },
    },
    { kind: 'miles', km: 1600 },
    { kind: 'superlative', superlatives: { coldest: { game_id: 'g2', value: 38.4 } } },
    { kind: 'goals', goals: [] },
    { kind: 'mystery' },
  ],
};

describe('parseWrapped', () => {
  it('normalizes every card and drops unknown kinds', () => {
    const w = parseWrapped(payload);
    expect(w).not.toBeNull();
    expect(w?.cards.map((c) => c.kind)).toEqual([
      'games',
      'record',
      'pledge',
      'stamps',
      'player',
      'moment',
      'companions',
      'miles',
      'superlative',
      'goals',
    ]);
    const pledge = w?.cards[2];
    expect(pledge?.kind === 'pledge' && pledge.pledge).toBeNull();
  });

  it('returns null for an empty season', () => {
    expect(parseWrapped(null)).toBeNull();
    expect(parseWrapped({ sport_id: 'mlb', season: 2026, cards: [] })).toBeNull();
  });
});

describe('wrappedCardCopy', () => {
  const w = parseWrapped(payload)!;
  const copy = (i: number) => wrappedCardCopy(w.cards[i]!, 'mlb', 2026);

  it('writes a headline and body for each card', () => {
    expect(copy(0)).toMatchObject({ label: 'Games attended', headline: '12' });
    expect(copy(1).headline).toBe('8–4');
    expect(copy(1).lines).toEqual(['Philadelphia Phillies 6–2']);
    expect(copy(2).headline).toBe('No pledges');
    expect(copy(3).lines).toEqual(['Wrigley Field']);
    expect(copy(4).headline).toBe('Bryce Harper');
    expect(copy(5).headline).toBe('Walk-off home run');
    expect(copy(6).lines).toEqual(['Lucky charm: Dad, 4–1', 'Jinx: Sam, 1–3']);
    expect(copy(7).headline).toBe('994 mi');
    expect(copy(8)).toMatchObject({ label: 'Coldest game', headline: '38°F' });
    expect(copy(9).headline).toBe('0');
  });
});

describe('seasons', () => {
  it('treats Jan and Feb as the previous NFL season', () => {
    expect(currentSeasonFor('nfl', new Date('2027-01-20T12:00:00'))).toBe(2026);
    expect(currentSeasonFor('nfl', new Date('2026-09-15T12:00:00'))).toBe(2026);
    expect(currentSeasonFor('mlb', new Date('2027-01-20T12:00:00'))).toBe(2027);
  });

  it('marks the current season as a preview and lists snapshots newest first', () => {
    const now = new Date('2026-09-15T12:00:00');
    expect(isPreviewSeason('mlb', 2026, now)).toBe(true);
    expect(isPreviewSeason('mlb', 2025, now)).toBe(false);
    const opts = seasonOptions(
      [{ sport_id: 'mlb', season: 2025, generated_at: '2025-11-05T00:00:00Z' }],
      now,
    );
    expect(opts.map((o) => `${o.sport_id}-${o.season}`)).toEqual([
      'mlb-2026',
      'nfl-2026',
      'mlb-2025',
    ]);
  });
});
