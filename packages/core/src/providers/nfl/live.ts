/**
 * ESPN's free NFL scoreboard, read by the phone (00_repo_reality.md R1: no paid feed; decision
 * 8 of 2026-09-22 lets the app read free public feeds). One document a day:
 * `site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=YYYYMMDD`, every game of
 * that Eastern date, with `status.type.name`, `status.period`, `status.displayClock` and each
 * competitor's `score` (docs/verification.md, 2026-09-23). A game under way also carries
 * `situation.lastPlay`, whose type names a return score, and, on ESPN's boards generally, a
 * `probability` with the home win percentage; both are read when present and never required.
 *
 * Games are matched by team, not by ESPN's id: an nflverse id is `2026_03_ATL_GB`, season, week,
 * away, home, and ESPN spells two clubs differently (LA is LAR, WAS is WSH).
 */
import type { LiveState } from '../../types.js';

export const ESPN_NFL_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

/** nflverse abbreviation to ESPN's, where they differ. */
export const ESPN_NFL_ABBREVIATIONS: Readonly<Record<string, string>> = { LA: 'LAR', WAS: 'WSH' };

export interface EspnNflCompetitor {
  homeAway: 'home' | 'away';
  score?: string | number;
  team: { id?: string; abbreviation: string; displayName?: string };
}

export interface EspnNflLastPlay {
  id?: string;
  type?: { id?: string; text?: string };
  text?: string;
  scoreValue?: number;
  team?: { id?: string };
  probability?: { homeWinPercentage?: number; awayWinPercentage?: number };
}

export interface EspnNflEvent {
  id: string;
  date: string;
  name?: string;
  competitions: {
    id?: string;
    date?: string;
    status?: {
      clock?: number;
      displayClock?: string;
      period?: number;
      type?: { name?: string; state?: string; completed?: boolean };
    };
    competitors: EspnNflCompetitor[];
    situation?: { lastPlay?: EspnNflLastPlay | null; possession?: string } | null;
  }[];
}

export interface EspnNflScoreboard {
  events?: EspnNflEvent[];
}

/** `2026_03_ATL_GB` to its parts, or null for anything else. */
export function parseNflverseGameId(id: string): { season: number; week: number; away: string; home: string } | null {
  const m = /^(\d{4})_(\d{2})_([A-Z]{2,3})_([A-Z]{2,3})$/.exec(id);
  return m ? { season: Number(m[1]), week: Number(m[2]), away: m[3]!, home: m[4]! } : null;
}

export function espnNflAbbreviation(nflverse: string): string {
  return ESPN_NFL_ABBREVIATIONS[nflverse] ?? nflverse;
}

/** The event on the board for an nflverse game: the same home and away clubs. */
export function findEspnNflEvent(doc: EspnNflScoreboard, nflverseGameId: string): EspnNflEvent | null {
  const parts = parseNflverseGameId(nflverseGameId);
  if (!parts) return null;
  const home = espnNflAbbreviation(parts.home);
  const away = espnNflAbbreviation(parts.away);
  return (
    (doc.events ?? []).find((e) => {
      const c = e.competitions[0];
      if (!c) return false;
      const h = c.competitors.find((x) => x.homeAway === 'home')?.team.abbreviation;
      const a = c.competitors.find((x) => x.homeAway === 'away')?.team.abbreviation;
      return h === home && a === away;
    }) ?? null
  );
}

export interface NflLiveExtras {
  /** ESPN's home win percentage on the last play, 0 to 1, when the board carries one. */
  homeWp: number | null;
  lastPlay: { text: string | null; type: string | null } | null;
}

function score(v: string | number | undefined): number {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * One event as the app's live row: the quarter in `inning` (5 and up is overtime), `live`,
 * `halftime` or `end` (of a period) in `inningState`, the display clock while play is on.
 */
export function parseEspnNflLiveState(event: EspnNflEvent, fetchedAt: string): { live: LiveState; extras: NflLiveExtras } | null {
  const c = event.competitions[0];
  if (!c?.status?.type) return null;
  const name = c.status.type.name ?? '';
  const state = c.status.type.state ?? '';
  const status: LiveState['status'] =
    state === 'post' || c.status.type.completed ? 'final' : state === 'in' ? 'live' : /POSTPONED/.test(name) ? 'postponed' : /CANCELED/.test(name) ? 'cancelled' : 'scheduled';
  const halftime = /HALFTIME/.test(name);
  const endPeriod = /END_PERIOD/.test(name);
  let inningState: LiveState['inningState'] = null;
  if (status === 'final') inningState = 'end';
  else if (status === 'live') inningState = halftime ? 'halftime' : endPeriod ? 'end' : 'live';
  const home = c.competitors.find((x) => x.homeAway === 'home');
  const away = c.competitors.find((x) => x.homeAway === 'away');
  const last = c.situation?.lastPlay ?? null;
  const pct = last?.probability?.homeWinPercentage;
  return {
    live: {
      status,
      inning: status === 'scheduled' ? null : (c.status.period || null),
      inningState,
      clock: status === 'live' && !halftime ? (c.status.displayClock ?? null) : null,
      homeScore: score(home?.score),
      awayScore: score(away?.score),
      fetchedAt,
    },
    extras: {
      homeWp: typeof pct === 'number' && pct >= 0 && pct <= 1 ? pct : null,
      lastPlay: last ? { text: last.text ?? null, type: last.type?.text ?? null } : null,
    },
  };
}
