/**
 * What to say under a name in the player picker.
 *
 * "Seen once" is the line that matters: it is the whole reason to follow a player rather
 * than bookmark one. `appearances` on its own is a fact about the database, not about you,
 * so it is only shown when you have not seen them and it is the only thing there is to say.
 */

export type RosterMetaInput = {
  seen_by_you: number;
  appearances: number;
  /** False for someone who has left the team. Absent before the roster migration lands. */
  on_roster?: boolean;
  position?: string | null;
};

/** "Seen once", "Seen 4 times", or null when you have not seen them. */
export function seenLine(p: Pick<RosterMetaInput, 'seen_by_you'>): string | null {
  if (p.seen_by_you === 1) return 'Seen once';
  if (p.seen_by_you > 1) return `Seen ${p.seen_by_you} times`;
  return null;
}

/**
 * The small mark beside a name: the position while they play for the team, "Former" once
 * they have left (they are still listed because you saw them). Null when neither is known,
 * which is every row until the roster migration lands.
 */
export function rosterMark(p: Pick<RosterMetaInput, 'on_roster' | 'position'>): string | null {
  const position = p.position?.trim() || null;
  if (p.on_roster === false) return position ? `Former ${position}` : 'Former';
  return position;
}

/** The one caption line under a name: the mark, then what you saw, or failing that the record. */
export function rosterMeta(p: RosterMetaInput): string {
  const parts: string[] = [];
  const mark = rosterMark(p);
  if (mark) parts.push(mark);
  const seen = seenLine(p);
  if (seen) parts.push(seen);
  else if (p.appearances === 1) parts.push('In 1 game on record');
  else if (p.appearances > 1) parts.push(`In ${p.appearances} games on record`);
  return parts.join(' · ');
}
