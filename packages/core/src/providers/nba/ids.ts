/**
 * NBA identifiers: game ids, seasons and team identities (docs/verification.md, "NBA data
 * sources"). Pure; no I/O.
 *
 * A game id is `00` + type + the season's two-digit start year + a sequence:
 * `0022400001` is the first regular-season game of 2024-25. Types seen in the game log:
 * `001` preseason, `002` regular season, `003` All-Star, `004` playoffs, `005` play-in,
 * `006` the in-season tournament final (the Emirates NBA Cup championship, a neutral-site
 * game that does not count in the standings).
 */
import type { GameType } from '../../types.js';
import { isEasternDaylightTime } from '../nfl/eastern.js';

export const NBA_PROVIDER = 'nba';

/** The season's start year from a game id, or null for something that is not one. */
export function seasonFromGameId(gameId: string): number | null {
  if (!/^\d{10}$/.test(gameId)) return null;
  return 2000 + Number(gameId.slice(3, 5));
}

/** '002' for a regular-season id, and so on. */
export function gameTypeCode(gameId: string): string {
  return gameId.slice(0, 3);
}

/**
 * The app's three game types. The play-in is postseason (it decides who plays in it); the Cup
 * final is a regular-season game played somewhere neutral; the All-Star game is preseason in
 * the sense that matters here, which is that it counts for nothing.
 */
export function gameTypeFromId(gameId: string): GameType {
  switch (gameTypeCode(gameId)) {
    case '002':
    case '006':
      return 'regular';
    case '004':
    case '005':
      return 'postseason';
    default:
      return 'preseason';
  }
}

/** '2024-25' for the season starting in 2024, the form stats.nba.com wants. */
export function seasonString(startYear: number): string {
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

/**
 * The stats.nba.com SeasonType values, verified 2026-09-17: any other spelling is a 400.
 * `IST` returns the tournament's group games (already in Regular Season) plus the `006`
 * final, which is the only row taken from it.
 */
export const SEASON_TYPES = {
  preseason: 'Pre Season',
  regular: 'Regular Season',
  playIn: 'PlayIn',
  playoffs: 'Playoffs',
  cup: 'IST',
} as const;

/**
 * The season a calendar date belongs to. The NBA season runs October to June, so anything
 * before August is the season that started the previous year.
 */
export function seasonForDate(isoDate: string): number {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  return month >= 8 ? year : year - 1;
}

/**
 * Team identities since 2000, read off the game log itself (docs/verification.md). The NBA
 * keeps one team id across a move or a rename, so a franchise that changed its name inside
 * the range is several `teams` rows on one NBA id, told apart by season. The current identity
 * uses the bare id as its provider id; each earlier one adds a suffix.
 */
export interface NbaTeamEra {
  teamId: string;
  /** First and last season (start years) the identity played under. */
  first: number;
  last: number;
  providerTeamId: string;
}

export const NBA_TEAM_ERAS: readonly NbaTeamEra[] = [
  { teamId: '1610612740', first: 2002, last: 2012, providerTeamId: '1610612740-NOH' },
  { teamId: '1610612751', first: 2000, last: 2011, providerTeamId: '1610612751-NJN' },
  { teamId: '1610612760', first: 2000, last: 2007, providerTeamId: '1610612760-SEA' },
  { teamId: '1610612763', first: 2000, last: 2000, providerTeamId: '1610612763-VAN' },
  { teamId: '1610612766', first: 2000, last: 2001, providerTeamId: '1610612766-CHH' },
  { teamId: '1610612766', first: 2004, last: 2013, providerTeamId: '1610612766-CHA-bobcats' },
];

/** The `teams.provider_team_id` for an NBA team id in a season. */
export function nbaProviderTeamId(teamId: string | number, season: number): string {
  const id = String(teamId);
  const era = NBA_TEAM_ERAS.find((e) => e.teamId === id && season >= e.first && season <= e.last);
  return era ? era.providerTeamId : id;
}

/** The NBA team id behind any provider team id, current or historical. */
export function nbaTeamIdOf(providerTeamId: string): string {
  return providerTeamId.split('-')[0]!;
}

/**
 * The calendar date in the Eastern zone of a UTC instant: the game log dates its games in ET,
 * and a 10:30 PM tip in Los Angeles is the next day in UTC.
 */
export function easternDateOf(iso: string): string {
  const utc = Date.parse(iso);
  // Decide daylight time from the Eastern wall clock, approximated first with the standard offset.
  const guess = utc - 5 * 3_600_000;
  const offsetHours = isEasternDaylightTime(guess) ? 4 : 5;
  return new Date(utc - offsetHours * 3_600_000).toISOString().slice(0, 10);
}

/** "PT11M43.00S" or "11:43" to seconds remaining, to the tenth. Null when unreadable. */
export function clockToSeconds(clock: string | null | undefined): number | null {
  if (!clock) return null;
  const iso = /^PT(?:(\d+)M)?(?:([\d.]+)S)?$/.exec(clock);
  if (iso) return Number(iso[1] ?? 0) * 60 + Number(iso[2] ?? 0);
  const mmss = /^(\d{1,2}):(\d{2})(?:\.(\d+))?$/.exec(clock);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]) + Number(`0.${mmss[3] ?? '0'}`);
  const secs = /^(\d+)\.(\d+)$/.exec(clock);
  if (secs) return Number(clock);
  return null;
}

/** "PT11M43.00S" to "11:43", the form the scoring list shows; "PT00M01.50S" to "0:01.5". */
export function clockLabel(clock: string | null | undefined): string | null {
  const s = clockToSeconds(clock);
  if (s == null) return null;
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  if (m === 0 && rest < 60 && !Number.isInteger(rest))
    return `0:${rest.toFixed(1).padStart(4, '0')}`;
  return `${m}:${String(Math.floor(rest)).padStart(2, '0')}`;
}
