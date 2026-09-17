import { eggs } from '@/features/eggs/flags';
import {
  certifiedJinxId,
  companionLuck,
  goodLuckCharmId,
  isCharmCandidate,
  isJinxCandidate,
  luckSentence,
  talliesFromRecords,
  type CompanionTally,
} from '@/features/eggs/jinx';

const OFF = { certifiedJinx: false } as const;

const c = (id: string, wins: number, losses: number, name = id): CompanionTally => ({
  id,
  name,
  wins,
  losses,
});

describe('the flag', () => {
  it('ships switched on', () => {
    expect(eggs.certifiedJinx).toBe(true);
  });
});

describe('isJinxCandidate', () => {
  it.each([
    [0, 4, true],
    [1, 3, true],
    [2, 4, false], // .333
    [0, 3, false], // too few
    [1, 4, true], // .200
    [2, 6, true], // .250 exactly
    [2, 5, false], // .286
    [0, 0, false],
  ])('%i wins and %i losses: %s', (wins, losses, expected) => {
    expect(isJinxCandidate(c('x', wins, losses))).toBe(expected);
  });

  it('refuses a record that is not a number', () => {
    expect(isJinxCandidate(c('x', Number.NaN, 4))).toBe(false);
  });
});

describe('isCharmCandidate', () => {
  it.each([
    [4, 0, true],
    [3, 1, true], // .750 exactly
    [4, 2, false], // .667
    [3, 0, false], // too few
    [7, 1, true],
  ])('%i wins and %i losses: %s', (wins, losses, expected) => {
    expect(isCharmCandidate(c('x', wins, losses))).toBe(expected);
  });
});

describe('certifiedJinxId', () => {
  it('is nobody when nobody qualifies', () => {
    expect(certifiedJinxId([])).toBeNull();
    expect(certifiedJinxId([c('a', 2, 4), c('b', 0, 3), c('d', 7, 1)])).toBeNull();
  });

  it('names only one, the worst', () => {
    expect(certifiedJinxId([c('a', 1, 3), c('b', 0, 4), c('d', 1, 4)])).toBe('b');
  });

  it('breaks a tie on the rate by more games, then by name', () => {
    expect(certifiedJinxId([c('a', 0, 4), c('b', 0, 6)])).toBe('b');
    expect(certifiedJinxId([c('a', 0, 4, 'Sam'), c('b', 0, 4, 'Jordan')])).toBe('b');
  });

  it('does not depend on the order it was given', () => {
    const list = [c('a', 1, 3), c('b', 0, 5), c('d', 0, 4)];
    expect(certifiedJinxId(list)).toBe('b');
    expect(certifiedJinxId([...list].reverse())).toBe('b');
  });

  it('ignores ties: the tally carries none, so 0 wins 4 losses 3 ties is still 0 for 4', () => {
    const rows = [{ person_id: 'p', display_name: 'Jordan', wins: 0, losses: 4, ties: 3 }];
    expect(certifiedJinxId(talliesFromRecords(rows))).toBe('p');
  });

  it('is nobody with the egg switched off', () => {
    expect(certifiedJinxId([c('b', 0, 4)], OFF)).toBeNull();
  });
});

describe('goodLuckCharmId', () => {
  it('names the one best companion', () => {
    expect(goodLuckCharmId([c('a', 3, 1), c('b', 7, 1), c('d', 4, 2)])).toBe('b');
  });

  it('breaks a tie by more games, then by name', () => {
    expect(goodLuckCharmId([c('a', 4, 0), c('b', 6, 0)])).toBe('b');
    expect(goodLuckCharmId([c('a', 4, 0, 'Maya'), c('b', 4, 0, 'Dad')])).toBe('b');
  });

  it('is nobody with the egg switched off', () => {
    expect(goodLuckCharmId([c('b', 7, 1)], OFF)).toBeNull();
  });
});

describe('companionLuck', () => {
  it('marks at most one of each', () => {
    const luck = companionLuck([
      c('dad', 7, 1),
      c('jordan', 0, 4),
      c('maya', 4, 2),
      c('sam', 1, 3),
    ]);
    expect([...luck.entries()].sort()).toEqual([
      ['dad', 'charm'],
      ['jordan', 'jinx'],
    ]);
  });

  it('is empty with the egg switched off', () => {
    expect(companionLuck([c('dad', 7, 1), c('jordan', 0, 4)], OFF).size).toBe(0);
  });
});

describe('luckSentence', () => {
  it('writes the record with an en dash and no em dash', () => {
    expect(luckSentence('jinx', 0, 4)).toBe('Certified jinx. You are 0–4 together.');
    expect(luckSentence('charm', 7, 1)).toBe('Good luck charm. You are 7–1 together.');
    expect(luckSentence('jinx', 1, 3)).not.toContain(String.fromCharCode(0x2014));
  });
});
