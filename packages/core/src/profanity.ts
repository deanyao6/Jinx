/**
 * The profanity filter (social brief 02, sections 3 and 8).
 *
 * Two strengths:
 *   - In a comment it is a soft warning: the fan sees "This might come across badly" and can
 *     post anyway. Only whole words count, so "Dickens" and "scrapbook" pass.
 *   - In a handle or a display name it is a hard stop, enforced by the database as well
 *     (`contains_profanity` in supabase/migrations/20260924010500_moderation.sql). There are no
 *     word breaks in "fuckyou99", so the handful of words that are never innocent inside another
 *     word are matched anywhere.
 *
 * The lists are mirrored in SQL; profanity.test.ts reads the migration and fails if the two
 * ever differ.
 */

/** Whole words, after undoing the usual letter swaps. */
export const PROFANE_WORDS: readonly string[] = [
  'asshole', 'assholes', 'bastard', 'bastards', 'bitch', 'bitches', 'bitchy', 'bullshit',
  'chink', 'chinks', 'cock', 'cocks', 'cocksucker', 'cunt', 'cunts', 'dick', 'dickhead',
  'dicks', 'fag', 'faggot', 'faggots', 'fags', 'fuck', 'fucked', 'fucker', 'fuckers',
  'fucking', 'fucks', 'kike', 'kikes', 'motherfucker', 'motherfuckers', 'motherfucking',
  'nigga', 'niggas', 'nigger', 'niggers', 'pussy', 'retard', 'retarded', 'retards', 'shit',
  'shits', 'shitty', 'slut', 'sluts', 'spic', 'spics', 'twat', 'twats', 'wank', 'wanker',
  'whore', 'whores',
];

/** Matched anywhere, for handles and names with no spaces. */
export const PROFANE_FRAGMENTS: readonly string[] = [
  'cunt', 'fag', 'fuck', 'kike', 'motherf', 'nigga', 'nigger', 'retard', 'shit', 'slut', 'whore',
];

const SWAPS: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '3': 'e',
  '4': 'a',
  '@': 'a',
  '5': 's',
  $: 's',
  '7': 't',
};

/** Lowercase, with 0 read as o, 1 and ! as i, 3 as e, 4 and @ as a, 5 and $ as s, 7 as t. */
export function unswap(text: string): string {
  return text.toLowerCase().replace(/[013457@$!]/g, (ch) => SWAPS[ch] ?? ch);
}

/** Whether a comment deserves the soft warning. */
export function hasProfanity(text: string): boolean {
  const words = unswap(text).split(/[^a-z]+/);
  return words.some((w) => w.length > 0 && PROFANE_WORDS.includes(w));
}

/** Whether a handle or display name is refused. */
export function nameHasProfanity(name: string): boolean {
  const flat = unswap(name).replace(/[^a-z]/g, '');
  return hasProfanity(name) || PROFANE_FRAGMENTS.some((f) => flat.includes(f));
}
