import { curseBroken, curseLine, CURSE_FRESH_DAYS } from '@/features/eggs/curse';
import { history } from '@/test/eggHistory';

const START = Date.UTC(2025, 3, 1, 23, 5);
const DAY = 24 * 60 * 60 * 1000;
/** The day after the last game of a history that long. */
const after = (games: number) => START + games * DAY;

describe('curseBroken', () => {
  it('triggers on a win after five straight losses', () => {
    expect(curseBroken(history('WLLLLLW'), { now: after(7) })).toEqual({ gameId: 'g6', losses: 5 });
  });

  it('counts the whole run', () => {
    expect(curseBroken(history('LLLLLLLLW'), { now: after(9) })).toEqual({
      gameId: 'g8',
      losses: 8,
    });
  });

  it('does not trigger after four', () => {
    expect(curseBroken(history('WLLLLW'), { now: after(6) })).toBeNull();
  });

  it('does not trigger again on the next win', () => {
    expect(curseBroken(history('LLLLLWW'), { now: after(7) })).toBeNull();
  });

  it('does not trigger while the streak is still a losing one, or has turned back into one', () => {
    expect(curseBroken(history('LLLLLL'), { now: after(6) })).toBeNull();
    expect(curseBroken(history('LLLLLWL'), { now: after(7) })).toBeNull();
  });

  it('lets a tie neither extend nor break the run', () => {
    // Five losses with a tie in the middle: still five, still a curse.
    expect(curseBroken(history('LLLTLLW'), { now: after(7) })).toEqual({ gameId: 'g6', losses: 5 });
    // Four losses and a tie is not five.
    expect(curseBroken(history('LLLLTW'), { now: after(6) })).toBeNull();
    // A tie after the win changes nothing: the latest decision is still that win.
    expect(curseBroken(history('LLLLLWT'), { now: after(7) })).toEqual({ gameId: 'g5', losses: 5 });
  });

  it('ignores neutral games and games that are not final', () => {
    expect(curseBroken(history('LLNLPLNLW'), { now: after(9) })).toEqual({
      gameId: 'g8',
      losses: 5,
    });
    expect(curseBroken(history('LLLLLN'), { now: after(6) })).toBeNull();
  });

  it('reads the games in date order whatever order they arrive in', () => {
    expect(curseBroken(history('LLLLLW').reverse(), { now: after(6) })).toEqual({
      gameId: 'g5',
      losses: 5,
    });
  });

  it('is not news once the win is old', () => {
    const games = history('LLLLLW');
    expect(curseBroken(games, { now: after(6) + CURSE_FRESH_DAYS * DAY })).toBeNull();
  });

  it('has nothing to say about an empty history', () => {
    expect(curseBroken([])).toBeNull();
  });
});

describe('curseLine', () => {
  it('says how long it was', () => {
    expect(curseLine(7)).toBe('Curse broken. 7 straight losses, over.');
  });
});
