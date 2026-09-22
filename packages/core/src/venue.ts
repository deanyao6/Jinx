/**
 * What a sport calls the building (Dean, 2026-09-17): baseball is played in a ballpark,
 * football in a stadium, basketball in an arena. A mixed set of venues is "venues". Every
 * piece of copy that names the building goes through this table, in the app and in SQL
 * (`public.venue_noun`), so a new sport is one row here and one there.
 */
export const VENUE_NOUN: Readonly<Record<string, { one: string; many: string }>> = {
  mlb: { one: 'ballpark', many: 'ballparks' },
  nfl: { one: 'stadium', many: 'stadiums' },
  nba: { one: 'arena', many: 'arenas' },
  mls: { one: 'stadium', many: 'stadiums' },
};

const GENERIC = { one: 'venue', many: 'venues' } as const;

/** "ballpark" / "ballparks" for a sport; "venue" / "venues" for a sport this does not know. */
export function venueNoun(sport: string | null | undefined, plural = false): string {
  const row = sport ? VENUE_NOUN[sport] : undefined;
  return plural ? (row?.many ?? GENERIC.many) : (row?.one ?? GENERIC.one);
}

/**
 * The word for a set of venues: the sport's own when every venue is that one sport, and
 * "venue" when the set mixes sports or is empty. `sports` is each venue's sports, flattened.
 */
export function venueNounFor(sports: readonly string[], plural = false): string {
  const distinct = new Set(sports);
  if (distinct.size !== 1) return plural ? GENERIC.many : GENERIC.one;
  return venueNoun([...distinct][0], plural);
}

/** "Ballpark", for a label. */
export function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
