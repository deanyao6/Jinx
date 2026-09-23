/**
 * The profanity filter (SPEC.md Section 11; social brief 02, sections 3 and 8). One list, three
 * places:
 *
 *   - Handles and display names: a hard stop. Lowercased, common letter swaps undone ("sh1t"),
 *     spaces and punctuation dropped ("F.u.c.k"), then any word matched anywhere, except the
 *     few short ones that live inside ordinary names ("bass", "Cassidy", "Cumberland"), which
 *     must stand alone. False positives on rare names are accepted: pick another handle. The
 *     database enforces the same rule (`contains_profanity` in
 *     supabase/migrations/20260924010500_moderation.sql).
 *   - Comments: a soft warning ("This might come across badly. Post anyway?"). Whole words only,
 *     with a few plain endings, so "Dickens" and "scrapbook" pass without a word.
 *
 * Moved here from apps/mobile/src/lib/profanity.ts (which re-exports it) so the app and the
 * database read one list; profanity.test.ts fails if the SQL copy ever differs.
 */
export const PROFANE_WORDS = [
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

/** Short words that are common inside ordinary names; in a name they must stand alone. */
export const PROFANE_WORDS_NEEDING_BOUNDARY = ['ass', 'cum', 'homo', 'anal', 'anus', 'fag', 'coon'] as const;

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

function unswap(input: string): string {
  return input
    .toLowerCase()
    .split('')
    .map((ch) => LEET[ch] ?? ch)
    .join('');
}

export function normalizeForProfanity(input: string): string {
  return unswap(input).replace(/[^a-z]/g, '');
}

/** Same normalization but keeps word boundaries as single spaces. */
function spaced(input: string): string {
  return unswap(input).replace(/[^a-z]+/g, ' ').trim();
}

const BOUNDARY = new Set<string>(PROFANE_WORDS_NEEDING_BOUNDARY);

/** Handles and display names: the hard stop. */
export function containsProfanity(input: string): boolean {
  const compact = normalizeForProfanity(input);
  if (!compact) return false;
  const words = spaced(input).split(' ');
  for (const word of PROFANE_WORDS) {
    if (BOUNDARY.has(word)) {
      if (words.includes(word)) return true;
      continue;
    }
    if (compact.includes(word)) return true;
  }
  return false;
}

const ENDINGS = ['', 's', 'es', 'ed', 'er', 'ers', 'ing', 'head', 'heads', 'hole', 'holes', 'ty', 'ter'];

/** Comments: whether to show the soft warning. Whole words, plain endings. */
export function hasProfanity(text: string): boolean {
  const words = spaced(text).split(' ').filter(Boolean);
  return words.some((w) => PROFANE_WORDS.some((p) => ENDINGS.some((e) => w === p + e)));
}

export const PROFANITY_WORD_COUNT = PROFANE_WORDS.length;
