import { sportLabel } from '@/lib/format';

/**
 * The sport a curated list is about, read from its slug: `mlb-all-venues`,
 * `nfl-division-afc-east` (see `rebuild_curated_bucket_lists` in the migrations). Achievement
 * lists and custom lists have no sport in their slug and return null.
 */
export function listSport(slug: string | null): string | null {
  const m = /^([a-z0-9]+)-(?:all-venues$|division-)/.exec(slug ?? '');
  return m ? (m[1] as string) : null;
}

export type SportGroup<T> = { key: string; title: string; lists: T[] };

/**
 * Lists grouped for browsing: one group per sport in the order the sports first appear, then the
 * achievement lists, which belong to no league, under "Moments".
 */
export function groupBySport<T extends { slug: string | null }>(lists: T[]): SportGroup<T>[] {
  const groups = new Map<string, SportGroup<T>>();
  const rest: T[] = [];
  for (const l of lists) {
    const sport = listSport(l.slug);
    if (!sport) {
      rest.push(l);
      continue;
    }
    const g = groups.get(sport) ?? { key: sport, title: sportLabel(sport), lists: [] };
    g.lists.push(l);
    groups.set(sport, g);
  }
  // The whole league first, then its divisions by title.
  for (const g of groups.values()) {
    g.lists.sort(
      (a, b) =>
        Number((b.slug ?? '').endsWith('-all-venues')) -
        Number((a.slug ?? '').endsWith('-all-venues')),
    );
  }
  const out = Array.from(groups.values());
  if (rest.length) out.push({ key: 'moments', title: 'Moments', lists: rest });
  return out;
}
