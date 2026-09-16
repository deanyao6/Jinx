/**
 * Small profanity filter for handles and display names (SPEC.md Section 11).
 * Matches on lowercase text with spaces, punctuation, and common leetspeak stripped, so
 * "F.u.c.k" and "sh1t" are caught. Substring matching is deliberate: false positives on rare
 * names are acceptable for a hobby app; the user can pick another handle.
 */
const WORDS = [
  'anal',
  'anus',
  'arse',
  'ass',
  'ballsack',
  'bastard',
  'bitch',
  'blowjob',
  'bollock',
  'boner',
  'boob',
  'bugger',
  'bullshit',
  'chink',
  'clit',
  'cock',
  'coon',
  'cum',
  'cunt',
  'dago',
  'dick',
  'dildo',
  'dyke',
  'fag',
  'faggot',
  'fuck',
  'gook',
  'handjob',
  'hitler',
  'homo',
  'jizz',
  'kike',
  'kkk',
  'lesbo',
  'milf',
  'motherfucker',
  'nazi',
  'negro',
  'nigga',
  'nigger',
  'paki',
  'penis',
  'piss',
  'porn',
  'prick',
  'pussy',
  'queef',
  'raghead',
  'rape',
  'retard',
  'scrotum',
  'shit',
  'slut',
  'spic',
  'tits',
  'tranny',
  'twat',
  'vagina',
  'wank',
  'wetback',
  'whore',
] as const;

// Short words that are common substrings of ordinary names ("bass", "cassidy", "cumberland").
const SHORT_WORDS_NEEDING_BOUNDARY = new Set(['ass', 'cum', 'homo', 'anal', 'anus', 'fag', 'coon']);

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
};

export function normalizeForProfanity(input: string): string {
  return input
    .toLowerCase()
    .split('')
    .map((ch) => LEET[ch] ?? ch)
    .join('')
    .replace(/[^a-z]/g, '');
}

/** Same normalization but keeps word boundaries as single spaces. */
function normalizeKeepingBoundaries(input: string): string {
  return input
    .toLowerCase()
    .split('')
    .map((ch) => LEET[ch] ?? ch)
    .join('')
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

export function containsProfanity(input: string): boolean {
  const compact = normalizeForProfanity(input);
  if (!compact) return false;
  const spaced = normalizeKeepingBoundaries(input);
  for (const word of WORDS) {
    if (SHORT_WORDS_NEEDING_BOUNDARY.has(word)) {
      if (new RegExp(`(^|\\s)${word}(\\s|$)`).test(spaced)) return true;
      continue;
    }
    if (compact.includes(word)) return true;
  }
  return false;
}

export const PROFANITY_WORD_COUNT = WORDS.length;
