/**
 * Minimal America/New_York -> UTC conversion for nflverse `gameday` + `gametime`.
 * US daylight saving rules since 2007: starts second Sunday of March at 02:00 local,
 * ends first Sunday of November at 02:00 local (clocks fall back to 01:00). No dependencies.
 */

const HOUR_MS = 3_600_000;
const EST_OFFSET_HOURS = 5;
const EDT_OFFSET_HOURS = 4;

/** Day of month for the nth Sunday (1-based) of a month; month is 0-based. */
function nthSunday(year: number, month: number, n: number): number {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const firstSunday = 1 + ((7 - firstDow) % 7);
  return firstSunday + (n - 1) * 7;
}

/**
 * Whether a wall-clock instant in the Eastern zone falls inside daylight saving time.
 * `wallClockMs` is the local date/time expressed as if it were UTC (Date.UTC of the local fields).
 * The repeated 01:00-02:00 hour on the November switch is treated as still on daylight time.
 */
export function isEasternDaylightTime(wallClockMs: number): boolean {
  const year = new Date(wallClockMs).getUTCFullYear();
  const dstStart = Date.UTC(year, 2, nthSunday(year, 2, 2), 2);
  const dstEnd = Date.UTC(year, 10, nthSunday(year, 10, 1), 2);
  return wallClockMs >= dstStart && wallClockMs < dstEnd;
}

/**
 * Convert a YYYY-MM-DD date and an HH:MM time in America/New_York to an ISO 8601 UTC string.
 * Throws on malformed input.
 */
export function easternToUtcIso(date: string, time: string): string {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) {
    throw new Error(`Invalid Eastern date/time: ${date} ${time}`);
  }
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]) - 1;
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const wallClockMs = Date.UTC(year, month, day, hour, minute);
  const offsetHours = isEasternDaylightTime(wallClockMs) ? EDT_OFFSET_HOURS : EST_OFFSET_HOURS;
  return new Date(wallClockMs + offsetHours * HOUR_MS).toISOString();
}
