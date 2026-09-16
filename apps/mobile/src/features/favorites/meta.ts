/**
 * What to say under a name in the player picker.
 *
 * "Seen once" is the line that matters: it is the whole reason to follow a player rather
 * than bookmark one. `appearances` on its own is a fact about the database, not about you,
 * so it is only shown when you have not seen them and it is the only thing there is to say.
 */
export function rosterMeta(p: { seen_by_you: number; appearances: number }): string {
  if (p.seen_by_you === 1) return 'Seen once';
  if (p.seen_by_you > 1) return `Seen ${p.seen_by_you} times`;
  return p.appearances === 1 ? 'In 1 game on record' : `In ${p.appearances} games on record`;
}
