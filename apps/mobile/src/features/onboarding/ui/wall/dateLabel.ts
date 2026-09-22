/**
 * What a game card says under its venue, relative to the day it is read.
 *
 * The weekly job writes the label it saw on Monday morning; by Thursday "Last night" would be
 * a lie, and a lie on the first screen reads as demo data. So the card also carries the local
 * date it was played on and whether it was an evening game, and the app works the label out
 * again each time from the device's own date. The rules are the same as
 * `welcome_wall_date_label()` in migration 20260923100000, and the SQL test and this one pin
 * the same cases.
 *
 *   yesterday           "Last night" for an evening game, "Yesterday" otherwise
 *   2 to 6 days ago     the weekday, with " night" for an evening game
 *   today, or older     the date, "Sep 20, 2026"
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `YYYY-MM-DD` as a UTC day number, so two dates subtract to whole days whatever the zone. */
function dayNumber(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  return Math.round(ms / 86_400_000);
}

/** The device's local calendar date as `YYYY-MM-DD`. */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDate(playedOn: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(playedOn);
  if (!m) return playedOn;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

export function dateLabel(playedOn: string, night: boolean, today: string): string {
  const played = dayNumber(playedOn);
  const now = dayNumber(today);
  if (played == null || now == null) return playedOn;
  const ago = now - played;
  if (ago === 1) return night ? 'Last night' : 'Yesterday';
  if (ago >= 2 && ago <= 6) {
    const weekday = DAYS[new Date(playedOn + 'T12:00:00Z').getUTCDay()] ?? '';
    return night ? `${weekday} night` : weekday;
  }
  return formatDate(playedOn);
}
