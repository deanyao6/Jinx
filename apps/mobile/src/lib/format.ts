/** Date and matchup formatting shared by list rows and detail screens. */

const DATE_SHORT: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
const DATE_LONG: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};
const TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

export function formatGameDate(iso: string, opts: { withYear?: boolean } = {}): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const withYear = opts.withYear ?? d.getFullYear() !== now.getFullYear();
  return d.toLocaleDateString(
    undefined,
    withYear ? { ...DATE_SHORT, year: 'numeric' } : DATE_SHORT,
  );
}

export function formatGameDateLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, DATE_LONG);
}

export function formatGameTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, TIME);
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime()) && toIsoDate(d) === s;
}

export type ScoreParts = {
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  isTie?: boolean | null;
};

/** "7–3" for finals, otherwise a status word. */
export function formatScore(g: ScoreParts): string {
  if (g.status === 'final' && g.homeScore != null && g.awayScore != null) {
    return `${g.awayScore}–${g.homeScore}`;
  }
  return statusLabel(g.status);
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'Scheduled';
    case 'live':
      return 'Live';
    case 'final':
      return 'Final';
    case 'postponed':
      return 'Postponed';
    case 'suspended':
      return 'Suspended';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export function sportLabel(sportId: string): string {
  return sportId === 'mlb' ? 'MLB' : sportId === 'nfl' ? 'NFL' : sportId.toUpperCase();
}

export function doubleheaderLabel(n: number | null | undefined): string | null {
  if (n === 1) return 'Doubleheader, game 1';
  if (n === 2) return 'Doubleheader, game 2';
  return null;
}

export function gameTypeLabel(t: string): string | null {
  if (t === 'postseason') return 'Postseason';
  if (t === 'preseason') return 'Preseason';
  return null;
}

export function formatPriceCents(cents: number | null | undefined): string | null {
  if (cents == null) return null;
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function parsePriceToCents(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function currentSeason(): number {
  return new Date().getFullYear();
}

export function seasonOptions(from = 2000): number[] {
  const out: number[] = [];
  for (let y = currentSeason(); y >= from; y -= 1) out.push(y);
  return out;
}
