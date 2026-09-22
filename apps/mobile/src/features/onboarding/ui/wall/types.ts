/**
 * The weekly welcome-wall payload (SPEC.md 8.8), and the one place it is checked.
 *
 * `GET /welcome-wall` answers `{ week_start, updated_at, cards: [...] }` with six cards written
 * by `welcome_wall_refresh()` (migration 20260923100000). The app never trusts it: a payload is
 * either exactly this shape, with every string short and every team a known one, or it is
 * ignored and the bundled fallback set draws instead. There is no zod in the mobile bundle
 * (it is an Edge Function dependency), so this is written out by hand and tested like any
 * other domain rule.
 */

import { teamFill } from './teamFills';

export const SPORTS = ['mlb', 'nfl', 'nba', 'mls'] as const;
export type WallSport = (typeof SPORTS)[number];

/** One game card on the wall. Only what the card draws; nothing about any user. */
export type WallGame = {
  gameId: string;
  sport: WallSport;
  /** "Phillies 7, Mets 2": winner first. */
  title: string;
  venue: string;
  /**
   * The local date the game was played, `YYYY-MM-DD`, so the app can say "Sunday" on Tuesday
   * and "Sep 20, 2026" once it is a week old (see dateLabel.ts). Null on the bundled fallback
   * cards, whose label is literal: they are the reference's copy and must not change with
   * the calendar.
   */
  playedOn: string | null;
  /** Started 17:00 or later local time: "Last night", "Monday night". */
  night: boolean;
  /** What the job wrote. Used as is when `playedOn` is null. */
  dateLabel: string;
  /** The side's result. The colour and the W or L are one team's. */
  result: 'W' | 'L';
  /** `provider:provider_team_id`, resolved to a colour by teamFills.ts. */
  teamKey: string;
  /**
   * The six bundled cards carry the reference's own hex, so `npm run parity` compares like
   * with like (the seed's Cowboys navy is a shade off the reference's). A payload card never
   * carries one: its colour always comes from the seed by team key.
   */
  fill?: string;
};

export type WelcomeWallPayload = {
  weekStart: string;
  updatedAt: string;
  cards: WallGame[];
};

/** How many cards the wall has room for. The payload must carry exactly this many. */
export const WALL_CARD_COUNT = 6;

const MAX_TITLE = 40;
const MAX_VENUE = 48;
const MAX_LABEL = 20;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TEAM_KEY = /^[a-z_]+:[A-Za-z0-9]+$/;

function str(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= max;
}

function card(raw: unknown): WallGame | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!str(r['game_id'], 64)) return null;
  if (!SPORTS.includes(r['sport'] as WallSport)) return null;
  if (!str(r['title'], MAX_TITLE) || !str(r['venue'], MAX_VENUE)) return null;
  if (!str(r['date_label'], MAX_LABEL)) return null;
  if (r['result'] !== 'W' && r['result'] !== 'L') return null;
  if (typeof r['night'] !== 'boolean') return null;
  if (r['played_on'] != null && !(typeof r['played_on'] === 'string' && DATE.test(r['played_on'])))
    return null;
  if (!str(r['team_key'], 32) || !TEAM_KEY.test(r['team_key'])) return null;
  // A team we have no colour for cannot be drawn, and a payload naming one is not ours.
  if (teamFill(r['team_key']) == null) return null;
  return {
    gameId: r['game_id'],
    sport: r['sport'] as WallSport,
    title: r['title'],
    venue: r['venue'],
    playedOn: (r['played_on'] as string | undefined) ?? null,
    night: r['night'],
    dateLabel: r['date_label'],
    result: r['result'],
    teamKey: r['team_key'],
  };
}

/**
 * The payload as the app will use it, or null for anything else: the wrong shape, five cards,
 * seven cards, a title long enough to break the card, a team we do not know. Null means the
 * bundled set draws. Extra keys on a card are ignored (the job writes its score and reasons
 * for people to read), so a future column does not break an old build.
 */
export function parseWelcomeWall(raw: unknown): WelcomeWallPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!str(r['week_start'], 10) || !DATE.test(r['week_start'])) return null;
  if (!str(r['updated_at'], 40) || Number.isNaN(Date.parse(r['updated_at']))) return null;
  if (!Array.isArray(r['cards']) || r['cards'].length !== WALL_CARD_COUNT) return null;
  const cards: WallGame[] = [];
  for (const c of r['cards']) {
    const parsed = card(c);
    if (!parsed) return null;
    cards.push(parsed);
  }
  return { weekStart: r['week_start'], updatedAt: r['updated_at'], cards };
}
