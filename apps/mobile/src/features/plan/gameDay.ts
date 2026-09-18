import { venueNoun } from '@jinx/core';

import type { GameDayFixture } from '@/features/data/shapes';
import { listSentence, shortTeamName, type TeamRef } from '@/features/data/names';

/**
 * The Plan tab, built from a game you have marked as going (SPEC.md 6.3, 6.4, 8.8.5).
 *
 * The reference's timeline is four things this app has no way to know: a drive time "with
 * Sunday traffic", which parking lot the tailgaters use, the shortest gate line, and a bar
 * with 34 fans going. None of it is in the database, and a plan that invents it is worse
 * than no plan, because you would act on it.
 *
 * So every line here is one of two kinds, and nothing else:
 *
 * - a SCHEDULE fact: when the game starts, where it is, which seat you logged;
 * - a rule the APP ITSELF enforces: when check-in opens (SPEC 6.3), and when a pick locks
 *   for a game you are neutral at (SPEC 6.4), worded as the spec words it.
 *
 * Drive time is the obvious next line, and would need a directions lookup from your home
 * city; it is left out rather than guessed.
 */

export type UpcomingGame = {
  rooting_team_id: string | null;
  seat: { section: string | null; row: string | null; seat: string | null } | null;
  companions: readonly { person: { id: string; display_name: string } | null }[];
  game: {
    id: string;
    sport_id: string;
    status: string;
    scheduled_start: string;
    home: { id: string; name: string } | null;
    away: { id: string; name: string } | null;
    venue: { name: string } | null;
  };
};

const MIN = 60_000;
const HOUR = 60 * MIN;

/** SPEC 6.3: the check-in window opens three hours before the scheduled start. */
const CHECK_IN_LEAD = 3 * HOUR;
/**
 * SPEC 6.3: with no final time known, the window closes six hours after the start. A game
 * stays on the Plan tab until then, so it is still there while you are in the building.
 */
const STILL_ON_FOR = 6 * HOUR;

/** Statuses that mean there will be no game to go to. */
const OFF = new Set(['final', 'cancelled', 'postponed']);

/** The next game you are going to, or null when there is none. */
export function nextUpcoming<T extends UpcomingGame>(games: readonly T[], now: number): T | null {
  let best: T | null = null;
  for (const g of games) {
    if (OFF.has(g.game.status)) continue;
    const start = Date.parse(g.game.scheduled_start);
    if (!Number.isFinite(start) || now > start + STILL_ON_FOR) continue;
    if (!best || start < Date.parse(best.game.scheduled_start)) best = g;
  }
  return best;
}

/** Calendar-day parts in a time zone, so "today" means today where the formatter is looking. */
function dayKey(ms: number, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ms);
}

function clock(ms: number, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(
    ms,
  );
}

/**
 * "Today, 7:05 PM", "Tomorrow, 7:05 PM", "Sunday, 7:05 PM", or "Sun, Sep 27, 7:05 PM".
 *
 * A weekday on its own is only unambiguous inside the coming week; the reference can say
 * "Sunday" because its game is days away. Past that the date is spelled out.
 */
export function whenLine(startMs: number, now: number, timeZone?: string): string {
  const time = clock(startMs, timeZone);
  const today = dayKey(now, timeZone);
  if (dayKey(startMs, timeZone) === today) return `Today, ${time}`;
  if (dayKey(startMs, timeZone) === dayKey(now + 24 * HOUR, timeZone)) return `Tomorrow, ${time}`;
  if (startMs - now < 6 * 24 * HOUR) {
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(startMs);
    return `${weekday}, ${time}`;
  }
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(startMs);
  return `${date}, ${time}`;
}

type TimelineItem = GameDayFixture['timeline'][number];

/** How each sport's game begins. */
const START_WORD: Readonly<Record<string, string>> = {
  mlb: 'First pitch',
  nfl: 'Kickoff',
  nba: 'Tip-off',
};

/** The lock rule per sport, worded as SPEC 6.4 words it, and the estimate it is ordered by. */
const LOCK_STEP: Readonly<Record<string, { time: string; text: string; minutes: number }>> = {
  mlb: {
    time: 'End of the 1st',
    text: 'Picks lock at the first run or the end of the 1st, whichever comes first.',
    minutes: 30,
  },
  nfl: {
    time: '10:00 in Q1',
    text: 'Picks lock at the first score or 10:00 in the 1st quarter.',
    minutes: 12,
  },
  nba: {
    time: 'End of Q1',
    text: 'Picks lock at the end of the 1st quarter.',
    minutes: 30,
  },
};

/**
 * The day, as the app will actually run it.
 *
 * `order` is when each step happens, used only to decide which one is "now". Two of them
 * have no clock time to show: a pick locks on the first score, which nobody can schedule,
 * so its label is the rule rather than a made-up time. The ordering instants for those use
 * the spec's own estimates (start + 30 minutes for MLB and the NBA, + 12 for NFL; SPEC 6.4).
 */
export function timeline(
  game: UpcomingGame['game'],
  matchup: string,
  neutral: boolean,
  now: number,
  timeZone?: string,
): TimelineItem[] {
  const start = Date.parse(game.scheduled_start);
  const sport = game.sport_id;
  const building = venueNoun(sport);
  const startWord = START_WORD[sport] ?? 'Kickoff';

  const steps: (Omit<TimelineItem, 'now'> & { order: number })[] = [
    {
      icon: 'i-verified',
      time: clock(start - CHECK_IN_LEAD, timeZone),
      text: neutral
        ? `Check-in opens. Check in at the ${building}, then pick a side.`
        : `Check-in opens. Check in at the ${building} to verify you were there.`,
      order: start - CHECK_IN_LEAD,
    },
    {
      icon: 'i-flag',
      time: clock(start, timeZone),
      text: `${startWord}. ${matchup}.`,
      order: start,
    },
  ];

  if (neutral) {
    const lock = LOCK_STEP[sport] ?? LOCK_STEP['nfl']!;
    steps.push({
      icon: 'i-lock',
      time: lock.time,
      text: lock.text,
      order: start + lock.minutes * MIN,
    });
  }

  steps.push({
    icon: 'i-spark',
    time: 'Final',
    text: 'Relive the game once it is final.',
    order: start + 3 * HOUR,
  });

  // "Now" is the next thing that has not happened yet. Once everything has, the last step
  // stays lit rather than none, so the screen never looks finished before the game is.
  const next = steps.findIndex((s) => s.order > now);
  const current = next === -1 ? steps.length - 1 : next;
  return steps.map(({ order: _order, ...s }, i) => ({ ...s, now: i === current }));
}

function matchupLine(game: UpcomingGame['game'], teams?: ReadonlyMap<string, TeamRef>): string {
  const name = (t: { id: string; name: string } | null) =>
    t ? shortTeamName(t.name, teams?.get(t.id)) : 'TBD';
  return `${name(game.away)} at ${name(game.home)}`;
}

/** Section, Row, Seat — only the ones you logged. The reference's Gate is not something we know. */
function seatFields(seat: UpcomingGame['seat']): GameDayFixture['seat'] {
  if (!seat) return [];
  const fields: { label: string; value: string }[] = [];
  if (seat.section) fields.push({ label: 'Section', value: seat.section });
  if (seat.row) fields.push({ label: 'Row', value: seat.row });
  if (seat.seat) fields.push({ label: 'Seat', value: seat.seat });
  return fields;
}

export function gameDayFromUpcoming(
  games: readonly UpcomingGame[],
  teams: ReadonlyMap<string, TeamRef>,
  now: number,
  timeZone?: string,
): GameDayFixture | null {
  const next = nextUpcoming(games, now);
  if (!next) return null;
  const { game } = next;
  const start = Date.parse(game.scheduled_start);
  // Once, so the ticket and the kickoff line can never disagree about a team's name.
  const matchup = matchupLine(game, teams);

  // A game with no side is the one you pick at (SPEC 6.4: "follows neither team"). The
  // rooting side is resolved when the game is logged, so a null here is exactly that case.
  const neutral = next.rooting_team_id == null;

  const people = next.companions
    .map((c) => c.person)
    .filter((p): p is { id: string; display_name: string } => p != null);

  return {
    // The ticket takes the colours of the side you are rooting for, falling back to the home
    // team when you have not picked one (the reference's away game is in Eagles colours).
    team: next.rooting_team_id ?? game.home?.id ?? 'none',
    game: {
      id: game.id,
      sport: game.sport_id,
      scheduledStart: game.scheduled_start,
      venue: game.venue?.name ?? null,
    },
    matchup,
    when: game.venue?.name
      ? `${whenLine(start, now, timeZone)}, ${game.venue.name}`
      : whenLine(start, now, timeZone),
    seat: seatFields(next.seat),
    companions: people.slice(0, 3).map((p) => p.id),
    companionsText: people.length
      ? `Going with ${listSentence(people.map((p) => p.display_name))}`
      : '',
    timeline: timeline(game, matchup, neutral, now, timeZone),
  };
}
