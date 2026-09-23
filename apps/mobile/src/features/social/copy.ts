/** Plain-copy builders for the Friends tab: overlap sentences, rivalry labels, records. */

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];

/** Spells out whole numbers up to twenty ("eleven"); larger or fractional values stay digits. */
export function numberWords(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (Number.isInteger(abs) && abs <= 20) {
    const word = ONES[abs] as string;
    return n < 0 ? `minus ${word}` : word;
  }
  return String(n);
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "2m", "3h", "5d", then a short date. */
export function relativeTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sec = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (sec < 60) return 'now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

export type OverlapRow = {
  other_display_name: string | null;
  other_handle: string;
  home_team_name: string;
  away_team_name: string;
  scheduled_start: string;
  section_gap: number | null;
};

export function monthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * "You and Maya were both at Phillies vs Mets in August 2019, eleven sections apart."
 * The section clause appears only when both users share seats (server sends null otherwise).
 */
export function overlapSentence(o: OverlapRow): string {
  const who = o.other_display_name?.trim() || `@${o.other_handle}`;
  const when = monthYear(o.scheduled_start);
  let s = `You and ${who} were both at ${o.home_team_name} vs ${o.away_team_name}`;
  if (when) s += ` in ${when}`;
  if (o.section_gap != null) {
    if (o.section_gap === 0) s += ', in the same section';
    else if (o.section_gap === 1) s += ', one section apart';
    else s += `, ${numberWords(o.section_gap)} sections apart`;
  }
  return `${s}.`;
}

/** "Jordan, Cowboys fan" / "Jordan, Cowboys and Bears fan" / "Jordan". */
export function rivalLabel(name: string, teams: string[]): string {
  if (teams.length === 0) return name;
  if (teams.length === 1) return `${name}, ${teams[0]} fan`;
  if (teams.length === 2) return `${name}, ${teams[0]} and ${teams[1]} fan`;
  return `${name}, ${teams.slice(0, -1).join(', ')}, and ${teams[teams.length - 1]} fan`;
}

/** Companion record as "7–1" or "7–1–2" with ties, and which color it should take. */
export function recordText(wins: number, losses: number, ties = 0): string {
  return ties > 0 ? `${wins}–${losses}–${ties}` : `${wins}–${losses}`;
}

export function recordTone(wins: number, losses: number): 'good' | 'bad' | 'even' {
  if (wins + losses === 0) return 'even';
  if (wins > losses) return 'good';
  if (losses > wins) return 'bad';
  return 'even';
}

export function gamesLabel(n: number): string {
  return n === 1 ? '1 game' : `${n} games`;
}
