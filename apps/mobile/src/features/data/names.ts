/**
 * How teams and people are named in prose.
 *
 * These lived in `supabase.ts`, which made that file the only place to get them. The Plan
 * tab needs them too, and `supabase.ts` imports the Plan tab to build its repository, so
 * reaching back into `supabase.ts` from there closed an import cycle. A cycle between two
 * modules that only call each other's functions later usually works, until a bundler
 * evaluates one half first and a function arrives as `undefined`. They live here instead,
 * and `supabase.ts` re-exports them so nothing that already imports them has to change.
 */

export type TeamRef = { id: string; name: string; city: string | null; abbreviation: string };

/** "Philadelphia Phillies" in "Philadelphia" is shown as "Phillies" on a pill. */
export function nickname(name: string, city: string | null | undefined): string {
  if (!city) return name;
  return name.startsWith(city) ? name.slice(city.length).trim() || name : name;
}

/** "Dad", "Dad and Maya", "Dad, Maya and Sam". The reference uses "and", not an ampersand. */
export function listSentence(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
