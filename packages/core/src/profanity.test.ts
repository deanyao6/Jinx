import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  containsProfanity,
  hasProfanity,
  PROFANE_WORDS,
  PROFANE_WORDS_NEEDING_BOUNDARY,
} from './profanity.js';

describe('names: a hard stop, matched anywhere', () => {
  it('refuses a word inside a handle, swaps and all', () => {
    expect(containsProfanity('fuckyou99')).toBe(true);
    expect(containsProfanity('sh1tposter')).toBe(true);
    expect(containsProfanity('F.u.c.k')).toBe(true);
  });

  it('lets the short words live inside ordinary names', () => {
    expect(containsProfanity('bass_fan')).toBe(false);
    expect(containsProfanity('Cassidy')).toBe(false);
    expect(containsProfanity('ass')).toBe(true);
  });

  it('allows ordinary handles', () => {
    expect(containsProfanity('deanyao')).toBe(false);
    expect(containsProfanity('phillies_phan')).toBe(false);
    expect(containsProfanity('Maya Chen')).toBe(false);
  });
});

describe('comments: a soft warning on whole words', () => {
  it('catches the word, its swaps, its case and plain endings', () => {
    expect(hasProfanity('What a shit call')).toBe(true);
    expect(hasProfanity('SH1T call')).toBe(true);
    expect(hasProfanity('you $luts')).toBe(true);
    expect(hasProfanity('fucking ump')).toBe(true);
  });

  it('leaves innocent words alone', () => {
    expect(hasProfanity('Reading Dickens in the 300 level')).toBe(false);
    expect(hasProfanity('Scunthorpe away day, spicy wings, a cockpit tour, Cassidy')).toBe(false);
    expect(hasProfanity('Great seats. Told you the 300 level was fine.')).toBe(false);
  });
});

describe('the SQL twin uses the same lists', () => {
  const sql = readFileSync(
    fileURLToPath(new URL('../../../supabase/migrations/20260924010500_moderation.sql', import.meta.url)),
    'utf8',
  );
  const arrayAfter = (marker: string): string[] => {
    const at = sql.indexOf(marker);
    expect(at, marker).toBeGreaterThan(-1);
    const open = sql.indexOf('array[', at) + 6;
    const body = sql.slice(open, sql.indexOf(']', open));
    return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
  };

  it('words', () => {
    expect(arrayAfter('-- profane words')).toEqual([...PROFANE_WORDS]);
  });

  it('words that must stand alone in a name', () => {
    expect(arrayAfter('-- profane words needing a boundary')).toEqual([...PROFANE_WORDS_NEEDING_BOUNDARY]);
  });
});
