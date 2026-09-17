/**
 * The personal line on Relive's final step (SPEC.md 6.19): "computed per user at view time,
 * not stored". It is read from the same records the Passport shows, so it states what is true
 * now, in the present tense, rather than claiming what the record "went to" on the night.
 */

export type PersonalInputs = {
  /** How the side the user rooted for did, or null for a neutral game with no pick. */
  result: 'win' | 'loss' | 'tie' | null;
  /** The first companion tagged at this game who has a record with the user. */
  companion: { name: string; wins: number; losses: number; ties: number } | null;
  /** The user's overall record at games they attended. */
  overall: { wins: number; losses: number; ties: number } | null;
};

// An en dash, as records are written everywhere else in the app (CLAUDE.md, Copy).
const DASH = String.fromCharCode(0x2013);

function record(r: { wins: number; losses: number; ties: number }): string {
  return r.ties > 0 ? `${r.wins}${DASH}${r.losses}${DASH}${r.ties}` : `${r.wins}${DASH}${r.losses}`;
}

export function personalLine(input: PersonalInputs): string | null {
  const { companion, overall, result } = input;
  if (companion && companion.wins + companion.losses + companion.ties > 0) {
    return `Your record with ${companion.name} is ${record(companion)}.`;
  }
  if (overall && overall.wins + overall.losses + overall.ties > 0) {
    const lead = result === 'win' ? 'You were there for the win. ' : '';
    return `${lead}You are ${record(overall)} at games you attend.`;
  }
  return null;
}

/** Appends the personal line to the last step only, leaving the stored text untouched. */
export function withPersonalLine<T extends { text: string }>(
  steps: readonly T[],
  line: string | null,
): T[] {
  if (!line || steps.length === 0) return [...steps];
  const last = steps.length - 1;
  return steps.map((step, i) => (i === last ? { ...step, text: `${step.text} ${line}` } : step));
}
