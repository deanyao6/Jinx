import { containsProfanity, normalizeForProfanity, PROFANITY_WORD_COUNT } from '../profanity';

describe('profanity filter', () => {
  it('ships a reasonably sized list', () => {
    expect(PROFANITY_WORD_COUNT).toBeGreaterThanOrEqual(40);
  });

  it('catches plain words and substrings', () => {
    expect(containsProfanity('fuck')).toBe(true);
    expect(containsProfanity('shithead')).toBe(true);
    expect(containsProfanity('Big Bitch Energy')).toBe(true);
  });

  it('catches spacing, punctuation, case, and leetspeak', () => {
    expect(containsProfanity('F.u.c.k')).toBe(true);
    expect(containsProfanity('s h i t')).toBe(true);
    expect(containsProfanity('SH1T')).toBe(true);
    expect(containsProfanity('a$$hole')).toBe(false); // "asshole" is not in the list; "ass" needs a boundary
    expect(containsProfanity('you a$$')).toBe(true);
  });

  it('leaves ordinary names alone', () => {
    expect(containsProfanity('dean')).toBe(false);
    expect(containsProfanity('phils_fan')).toBe(false);
    expect(containsProfanity('Cassidy')).toBe(false);
    expect(containsProfanity('cumberland')).toBe(false);
    expect(containsProfanity('bassmaster')).toBe(false);
    expect(containsProfanity('Homer Simpson')).toBe(false);
    expect(containsProfanity('')).toBe(false);
  });

  it('normalizes by lowercasing, mapping leetspeak, and stripping non-letters', () => {
    expect(normalizeForProfanity('Ph!l5 F@n 2019')).toBe('philsfanoi');
  });
});
