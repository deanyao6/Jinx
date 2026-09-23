import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { hasProfanity, nameHasProfanity, PROFANE_FRAGMENTS, PROFANE_WORDS } from './profanity.js';

describe('comments: a soft warning on whole words', () => {
  it('catches the word, its swaps and its case', () => {
    expect(hasProfanity('What a shit call')).toBe(true);
    expect(hasProfanity('SH1T call')).toBe(true);
    expect(hasProfanity('f.u.c.k')).toBe(false);
    expect(hasProfanity('you $lut')).toBe(true);
  });

  it('leaves innocent words alone', () => {
    expect(hasProfanity('Reading Dickens in the 300 level')).toBe(false);
    expect(hasProfanity('Scunthorpe away day, spicy wings, a cockpit tour')).toBe(false);
    expect(hasProfanity('Great seats. Told you the 300 level was fine.')).toBe(false);
  });
});

describe('names: a hard stop, fragments matched anywhere', () => {
  it('refuses a fragment inside a handle', () => {
    expect(nameHasProfanity('fuckyou99')).toBe(true);
    expect(nameHasProfanity('sh1tposter')).toBe(true);
  });

  it('allows ordinary handles', () => {
    expect(nameHasProfanity('deanyao')).toBe(false);
    expect(nameHasProfanity('phillies_phan')).toBe(false);
    expect(nameHasProfanity('Maya Chen')).toBe(false);
  });
});

describe('the SQL twin uses the same lists', () => {
  const sql = readFileSync(
    fileURLToPath(
      new URL('../../../supabase/migrations/20260924010500_moderation.sql', import.meta.url),
    ),
    'utf8',
  );
  const arrayAfter = (marker: string): string[] => {
    const at = sql.indexOf(marker);
    expect(at, marker).toBeGreaterThan(-1);
    const body = sql.slice(sql.indexOf('array[', at) + 6, sql.indexOf(']', at));
    return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
  };

  it('words', () => {
    expect(arrayAfter('-- profane words')).toEqual([...PROFANE_WORDS]);
  });

  it('fragments', () => {
    expect(arrayAfter('-- profane fragments')).toEqual([...PROFANE_FRAGMENTS]);
  });
});
