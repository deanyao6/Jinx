import {
  formatTally,
  MAX_REPLAY_STEPS,
  parseTally,
  replaySteps,
  replayTiming,
  rewindFrames,
} from '@/features/eggs/rewind';
import { history } from '@/test/eggHistory';

const day = (iso: string) => iso.slice(0, 10);

describe('replaySteps', () => {
  it('counts shootout wins and losses without changing the goals', () => {
    const games = history('TTT').map((g, i) => ({
      ...g,
      winnerTeamId: i === 0 ? g.homeTeamId : i === 1 ? g.awayTeamId : null,
    }));
    expect(replaySteps(games).map(({ w, l, t }) => [w, l, t])).toEqual([
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ]);
  });
  it('ticks the record game by game, oldest first, and names each game', () => {
    const steps = replaySteps(history('WLW').reverse(), { formatDate: day });
    expect(steps.map(({ w, l, t }) => [w, l, t])).toEqual([
      [1, 0, 0],
      [1, 1, 0],
      [2, 1, 0],
    ]);
    expect(steps[0]?.label).toBe('2025-04-01 · NYM at PHI · W');
    expect(steps[1]?.label).toBe('2025-04-02 · NYM at PHI · L');
  });

  it('formats the date like the rest of the app by default', () => {
    const [step] = replaySteps(history('W', Date.UTC(2025, 8, 16, 19, 0)));
    expect(step?.label).toMatch(/^Sep 16, 2025 · NYM at PHI · W$/);
  });

  it('counts a tie as its own step', () => {
    const steps = replaySteps(history('WTL'), { formatDate: day });
    expect(steps.map(({ w, l, t }) => [w, l, t])).toEqual([
      [1, 0, 0],
      [1, 0, 1],
      [1, 1, 1],
    ]);
    expect(steps[1]?.label.endsWith('T')).toBe(true);
  });

  it('skips neutral games with no side, and games that are not final', () => {
    const steps = replaySteps(history('WNLPW'), { formatDate: day });
    expect(steps).toHaveLength(3);
    expect(steps[steps.length - 1]).toMatchObject({ w: 2, l: 1, t: 0 });
  });

  it('does nothing for an empty history, or one with no results', () => {
    expect(replaySteps([])).toEqual([]);
    expect(replaySteps(history('NNP'))).toEqual([]);
  });

  it('follows the team pill: only the games rooted for that team', () => {
    const games = history('WLWL').map((g, i) => (i % 2 === 0 ? g : { ...g, rootingTeamId: 'nym' }));
    // As a Mets fan those two Phillies losses at home are wins.
    expect(replaySteps(games, { pill: 'nym' }).pop()).toMatchObject({ w: 2, l: 0 });
    expect(replaySteps(games, { pill: 'phi' }).pop()).toMatchObject({ w: 2, l: 0 });
    expect(replaySteps(games, { pill: 'all' }).pop()).toMatchObject({ w: 4, l: 0 });
    expect(replaySteps(games, { pill: 'lad' })).toEqual([]);
  });

  it('samples a long history but always ends exactly on the true record', () => {
    const results = Array.from({ length: 401 }, (_, i) => (i % 3 === 0 ? 'L' : 'W')).join('');
    const steps = replaySteps(history(results));
    expect(steps).toHaveLength(MAX_REPLAY_STEPS);
    const losses = Math.ceil(401 / 3);
    expect(steps[steps.length - 1]).toMatchObject({ w: 401 - losses, l: losses, t: 0 });
    // Sampled steps are still the true record as of that game: never out of order.
    for (let i = 1; i < steps.length; i += 1) {
      const a = steps[i - 1]!;
      const b = steps[i]!;
      expect(b.w + b.l).toBeGreaterThan(a.w + a.l);
    }
  });

  it('does not sample at or under the limit', () => {
    expect(replaySteps(history('W'.repeat(MAX_REPLAY_STEPS)))).toHaveLength(MAX_REPLAY_STEPS);
    expect(replaySteps(history('WLWLW'), { maxSteps: 2 }).pop()).toMatchObject({ w: 3, l: 2 });
  });
});

describe('replayTiming', () => {
  it('keeps the whole replay between 4 and 8 seconds once there is a real history', () => {
    for (const n of [10, 12, 48, 150, 400]) {
      const { totalMs, stepMs } = replayTiming(Math.min(n, MAX_REPLAY_STEPS));
      expect(totalMs).toBeGreaterThanOrEqual(4000);
      expect(totalMs).toBeLessThanOrEqual(8000);
      expect(stepMs).toBeGreaterThan(40);
    }
  });

  it('steps faster the longer the history', () => {
    expect(replayTiming(150).stepMs).toBeLessThan(replayTiming(48).stepMs);
    expect(replayTiming(48).stepMs).toBeLessThan(replayTiming(12).stepMs);
  });

  it('is short for a short history and nothing for none', () => {
    expect(replayTiming(3).totalMs).toBe(1200);
    expect(replayTiming(0)).toEqual({ stepMs: 0, totalMs: 0 });
  });
});

describe('the odometer', () => {
  it('winds back to zero', () => {
    const frames = rewindFrames({ w: 31, l: 17, t: 0 }, 12);
    expect(frames).toHaveLength(12);
    expect(frames[frames.length - 1]).toEqual({ w: 0, l: 0, t: 0 });
    expect(frames[0]!.w).toBeLessThan(31);
  });

  it('writes and reads the hero record, with an en dash and never an em dash', () => {
    expect(formatTally({ w: 31, l: 17, t: 0 })).toBe('31 – 17');
    expect(formatTally({ w: 6, l: 2, t: 1 })).toBe('6 – 2 – 1');
    expect(parseTally('31 – 17')).toEqual({ w: 31, l: 17, t: 0 });
    expect(parseTally('6 – 2 – 1')).toEqual({ w: 6, l: 2, t: 1 });
    expect(parseTally('No games')).toBeNull();
  });
});
