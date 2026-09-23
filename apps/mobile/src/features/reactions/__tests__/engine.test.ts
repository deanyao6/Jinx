import { engineStep, initialEngineState, type EngineContext } from '../engine';
import type { LiveState } from '@/features/checkin/lock';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const at = (n: number) => `2026-09-24T02:${String(n).padStart(2, '0')}:00Z`;

function row(over: Partial<LiveState>): LiveState {
  return {
    status: 'live',
    inning: 1,
    inning_state: 'live',
    clock: null,
    home_score: 0,
    away_score: 0,
    locked: false,
    lock_reason: null,
    fetched_at: at(0),
    ...over,
  };
}

describe('the phone-side engine, one poll at a time', () => {
  const nba: EngineContext = { gameId: 'g', sport: 'nba', homeName: 'Lakers', awayName: 'Celtics', homePrior: 0.5 };

  it('reports the scheduled prompt once, at eight minutes left in the 4th for the NBA', () => {
    let state = initialEngineState();
    const polls = [
      row({ inning: 3, clock: '2:00', home_score: 80, away_score: 82, fetched_at: at(1) }),
      row({ inning: 4, clock: '11:00', home_score: 84, away_score: 86, fetched_at: at(2) }),
      row({ inning: 4, clock: '7:40', home_score: 90, away_score: 92, fetched_at: at(3) }),
      row({ inning: 4, clock: '6:00', home_score: 92, away_score: 96, fetched_at: at(4) }),
    ];
    const all = [];
    for (const p of polls) {
      const r = engineStep(state, p, nba);
      state = r.next;
      all.push(...r.reports);
    }
    expect(all.map((r) => [r.kind, r.periodLabel])).toEqual([['checkin', 'Q4 7:40']]);
    expect(all[0]).toMatchObject({ audience: 'all', eventKey: 'scheduled', homeScore: 90, awayScore: 92, inScheduledWindow: true, rule: 'window_middle' });
  });

  it('reports a late go-ahead score as an event, once, with its key, and merged inside the window', () => {
    let state = initialEngineState();
    const r1 = engineStep(state, row({ inning: 4, clock: '1:40', home_score: 100, away_score: 101, fetched_at: at(1) }), nba);
    // The first poll is already at the window's end: the scheduled prompt goes at once.
    expect(r1.reports.map((r) => [r.kind, r.rule])).toEqual([['checkin', 'window_end']]);
    state = r1.next;
    const r2 = engineStep(state, row({ inning: 4, clock: '1:10', home_score: 103, away_score: 101, fetched_at: at(2) }), nba);
    expect(r2.reports.map((r) => [r.kind, r.rule])).toEqual([['event', 'late_go_ahead_score']]);
    expect(r2.reports[0]).toMatchObject({ eventKey: 'nba:score:4:103-101', audience: 'home', inScheduledWindow: true });
    const r3 = engineStep(r2.next, row({ inning: 4, clock: '1:10', home_score: 103, away_score: 101, fetched_at: at(3) }), nba);
    expect(r3.reports).toEqual([]);
  });

  it('NFL: a score that swings the margin, with the last play the board names', () => {
    const nfl: EngineContext = { ...nba, sport: 'nfl', homeName: 'Eagles', awayName: 'Rams' };
    let state = initialEngineState();
    const first = engineStep(state, row({ inning: 4, clock: '4:12', home_score: 20, away_score: 24, fetched_at: at(1) }), nfl);
    expect(first.reports.map((x) => x.rule)).toEqual(['window_middle']);
    state = first.next;
    const r = engineStep(state, row({ inning: 4, clock: '3:50', home_score: 27, away_score: 24, fetched_at: at(2), extras: { lastPlay: { text: 'S.Barkley 90 yd run', type: 'Rushing Touchdown' }, homeWp: 0.8 } }), nfl);
    expect(r.reports.map((x) => x.rule)).toEqual(['go_ahead_score']);
    expect(r.reports[0]).toMatchObject({ label: 'Touchdown, Eagles', audience: 'home', eventKey: 'nfl:score:4:27-24' });
  });

  it('MLS: only the key events since the last poll, and nothing on the first', () => {
    const mls: EngineContext = { ...nba, sport: 'mls', homeName: 'Inter Miami', awayName: 'Charlotte' };
    const play = (seq: number, over: Record<string, unknown>) => ({
      seq, period: 2, minute: 60, clock: "60'", wallclock: null, type: 'Goal', text: '', homeScore: 0, awayScore: 0, scoringSide: null, scorerName: null, kind: null, ...over,
    });
    const first = row({ inning: 2, clock: "70'", home_score: 1, away_score: 0, fetched_at: at(1), extras: { plays: [play(1, { minute: 20, clock: "20'", homeScore: 1, scoringSide: 'home' })] } });
    const r1 = engineStep(initialEngineState(), first, mls);
    expect(r1.reports).toEqual([]);
    const second = row({ inning: 2, clock: "86'", home_score: 1, away_score: 0, fetched_at: at(2), extras: { plays: [play(1, { minute: 20, clock: "20'", homeScore: 1, scoringSide: 'home' }), play(2, { minute: 85, clock: "85'", type: 'Red Card', text: 'Red card, Charlotte', homeScore: 1 })] } });
    const r2 = engineStep(r1.next, second, mls);
    expect(r2.reports.map((x) => [x.kind, x.rule])).toEqual([
      ['event', 'red_card'],
      ['checkin', 'window_middle'],
    ]);
  });

  it('never reports MLB: the server runs those rules', () => {
    const mlb: EngineContext = { ...nba, sport: 'mlb' };
    const r = engineStep(initialEngineState(), row({ inning: 8, inning_state: 'top', home_score: 2, away_score: 4 }), mlb);
    expect(r.reports).toEqual([]);
  });
});
