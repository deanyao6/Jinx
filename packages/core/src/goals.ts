/**
 * Goal and bucket-list predicate evaluator (SPEC.md 6.13, 6.14). Typed JSON predicates evaluated over
 * the user's attended games; no SQL from the client.
 */
import type { RootingBasis } from './rooting.js';
import type { GameResult } from './records.js';
import type { Sport } from './types.js';

export interface GoalGame {
  gameId: string;
  sport: Sport;
  /** ISO date/time of the game. */
  scheduledStart: string;
  /** Calendar year of the game in local terms (season year is fine for both sports). */
  year: number;
  venueId: string | null;
  homeTeamId: string;
  awayTeamId: string;
  /** Franchise ids of both teams, for "your team" filters. */
  homeFranchiseId: string;
  awayFranchiseId: string;
  rootingTeamId: string | null;
  rootingFranchiseId: string | null;
  rootingBasis: RootingBasis | null;
  result: GameResult | null;
  /** Event types witnessed in this game (home_run, walk_off, ...). */
  events: string[];
  /** Person ids tagged as companions. */
  companions: string[];
  /** True when this game was the user's first ever visit to its venue. */
  isNewVenue: boolean;
  /** True when this game was the user's first ever visit to its venue's state (badges only). */
  isNewState: boolean;
  /** The venue's IANA time zone, when known (badges only). */
  timezone: string | null;
  temperatureF: number | null;
  isDoubleheader: boolean;
  isOpeningDay: boolean;
  /** Great-circle miles from the user's home to the venue, when both are known (badges only). */
  distanceFromHomeMiles: number | null;
  pledge?: { status: 'provisional' | 'valid' | 'void'; winProbAtPledge: number } | undefined;
  /** True when the game was final at evaluation time. */
  isFinal: boolean;
}

export interface GoalFilter {
  sport?: Sport;
  year?: number;
  /** Game event type that must be present. */
  event?: string;
  /** Franchise id of "your team": the game counts when you rooted for it. */
  team?: string;
  /** With `team`: the game must not be at that team's home venue (i.e. your team was the away side). */
  venue_not_home?: boolean;
  rooting_basis?: RootingBasis;
  result?: GameResult;
  new_venue?: boolean;
  venue_ids?: string[];
  doubleheader?: boolean;
  opening_day?: boolean;
  new_state?: boolean;
  /** Degrees Fahrenheit; the game must be at or below this. */
  temperature_max?: number;
  /** The venue must be at least this many miles from home. */
  min_distance_miles?: number;
}

export type GoalDefinition =
  | { type: 'count'; target: number; filter?: GoalFilter }
  | { type: 'distinct_venues'; target: number; filter?: GoalFilter }
  | { type: 'distinct_people'; target: number; filter?: GoalFilter }
  | { type: 'exists'; filter?: GoalFilter }
  | { type: 'record'; filter?: GoalFilter; min_win_pct: number; min_games: number }
  | { type: 'vs_expected'; min: number; filter?: GoalFilter }
  | { type: 'all_of'; items: GoalDefinition[] }
  | { type: 'any_of'; items: GoalDefinition[] }
  /** Most distinct venues reachable within any `windowDays`-day span ("3 parks in one weekend"). */
  | { type: 'distinct_venues_in_window'; target: number; windowDays: number; filter?: GoalFilter }
  | { type: 'distinct_timezones'; target: number; filter?: GoalFilter }
  /**
   * The best (or worst) win rate with any single companion, at `minGames` or more decided games
   * together. Set `minWinPct` for "undefeated with one companion", `maxWinPct` for the opposite
   * ("certified jinx"). Exactly one of the two is read.
   */
  | {
      type: 'companion_record';
      minGames: number;
      minWinPct?: number;
      maxWinPct?: number;
      filter?: GoalFilter;
    }
  /** A losing streak of `minLosses` or more, immediately followed by a win. */
  | { type: 'streak_break'; minLosses: number; filter?: GoalFilter }
  /** The most visits to any single venue reaches `target` ("a stamp worn from repeat visits"). */
  | { type: 'max_venue_visits'; target: number; filter?: GoalFilter };

export interface GoalProgress {
  /** Current value toward the target (games, venues, people, wins...). */
  current: number;
  target: number;
  completed: boolean;
  /** For composite goals, each item's progress. */
  items?: GoalProgress[] | undefined;
}

export function matchesFilter(g: GoalGame, f: GoalFilter | undefined): boolean {
  if (!f) return true;
  if (f.sport && g.sport !== f.sport) return false;
  if (f.year !== undefined && g.year !== f.year) return false;
  if (f.event && !g.events.includes(f.event)) return false;
  if (f.team) {
    if (g.rootingFranchiseId !== f.team) return false;
    if (f.venue_not_home && g.rootingTeamId !== g.awayTeamId) return false;
  } else if (f.venue_not_home && g.rootingTeamId !== null && g.rootingTeamId !== g.awayTeamId) {
    return false;
  }
  if (f.rooting_basis && g.rootingBasis !== f.rooting_basis) return false;
  if (f.result && g.result !== f.result) return false;
  if (f.new_venue && !g.isNewVenue) return false;
  if (f.venue_ids && (g.venueId === null || !f.venue_ids.includes(g.venueId))) return false;
  if (f.doubleheader && !g.isDoubleheader) return false;
  if (f.opening_day && !g.isOpeningDay) return false;
  if (f.new_state && !g.isNewState) return false;
  if (f.temperature_max !== undefined && (g.temperatureF === null || g.temperatureF > f.temperature_max))
    return false;
  if (
    f.min_distance_miles !== undefined &&
    (g.distanceFromHomeMiles === null || g.distanceFromHomeMiles < f.min_distance_miles)
  )
    return false;
  return true;
}

export function evaluateGoal(def: GoalDefinition, games: GoalGame[]): GoalProgress {
  const finals = games.filter((g) => g.isFinal);
  switch (def.type) {
    case 'count': {
      const n = finals.filter((g) => matchesFilter(g, def.filter)).length;
      return { current: n, target: def.target, completed: n >= def.target };
    }
    case 'distinct_venues': {
      const venues = new Set(
        finals
          .filter((g) => matchesFilter(g, def.filter))
          .map((g) => g.venueId)
          .filter((v): v is string => v !== null),
      );
      return { current: venues.size, target: def.target, completed: venues.size >= def.target };
    }
    case 'distinct_people': {
      const people = new Set(
        finals.filter((g) => matchesFilter(g, def.filter)).flatMap((g) => g.companions),
      );
      return { current: people.size, target: def.target, completed: people.size >= def.target };
    }
    case 'exists': {
      const n = finals.filter((g) => matchesFilter(g, def.filter)).length;
      return { current: Math.min(n, 1), target: 1, completed: n >= 1 };
    }
    case 'record': {
      const decided = finals.filter(
        (g) => matchesFilter(g, def.filter) && (g.result === 'win' || g.result === 'loss'),
      );
      const wins = decided.filter((g) => g.result === 'win').length;
      const pct = decided.length === 0 ? 0 : wins / decided.length;
      const completed = decided.length >= def.min_games && pct >= def.min_win_pct;
      return { current: decided.length, target: def.min_games, completed };
    }
    case 'vs_expected': {
      let total = 0;
      for (const g of finals) {
        if (!matchesFilter(g, def.filter)) continue;
        if (g.rootingBasis !== 'pledge' || g.pledge?.status !== 'valid' || g.result === null)
          continue;
        total += (g.result === 'win' ? 1 : g.result === 'tie' ? 0.5 : 0) - g.pledge.winProbAtPledge;
      }
      return {
        current: Math.round(total * 100) / 100,
        target: def.min,
        completed: total >= def.min,
      };
    }
    case 'all_of': {
      const items = def.items.map((d) => evaluateGoal(d, games));
      const done = items.filter((i) => i.completed).length;
      return { current: done, target: items.length, completed: done === items.length, items };
    }
    case 'any_of': {
      const items = def.items.map((d) => evaluateGoal(d, games));
      const done = items.filter((i) => i.completed).length;
      return { current: Math.min(done, 1), target: 1, completed: done >= 1, items };
    }
    case 'distinct_venues_in_window': {
      const matched = finals
        .filter((g) => matchesFilter(g, def.filter) && g.venueId !== null)
        .map((g) => ({ t: Date.parse(g.scheduledStart), venueId: g.venueId as string }))
        .sort((a, b) => a.t - b.t);
      const windowMs = def.windowDays * 86_400_000;
      let best = 0;
      for (let i = 0; i < matched.length; i++) {
        const set = new Set<string>();
        for (let j = i; j < matched.length && matched[j]!.t - matched[i]!.t <= windowMs; j++) {
          set.add(matched[j]!.venueId);
        }
        best = Math.max(best, set.size);
      }
      return { current: best, target: def.target, completed: best >= def.target };
    }
    case 'distinct_timezones': {
      const zones = new Set(
        finals
          .filter((g) => matchesFilter(g, def.filter) && g.timezone !== null)
          .map((g) => g.timezone as string),
      );
      return { current: zones.size, target: def.target, completed: zones.size >= def.target };
    }
    case 'companion_record': {
      const decided = finals.filter(
        (g) => matchesFilter(g, def.filter) && (g.result === 'win' || g.result === 'loss'),
      );
      const byCompanion = new Map<string, { wins: number; games: number }>();
      for (const game of decided) {
        for (const companion of game.companions) {
          const row = byCompanion.get(companion) ?? { wins: 0, games: 0 };
          row.games++;
          if (game.result === 'win') row.wins++;
          byCompanion.set(companion, row);
        }
      }
      let found = false;
      for (const row of byCompanion.values()) {
        if (row.games < def.minGames) continue;
        const pct = row.wins / row.games;
        if (def.minWinPct !== undefined && pct >= def.minWinPct) found = true;
        if (def.maxWinPct !== undefined && pct <= def.maxWinPct) found = true;
      }
      return { current: found ? 1 : 0, target: 1, completed: found };
    }
    case 'streak_break': {
      const decided = finals
        .filter((g) => matchesFilter(g, def.filter) && (g.result === 'win' || g.result === 'loss'))
        .sort((a, b) => Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart));
      let run = 0;
      let found = false;
      for (const game of decided) {
        if (game.result === 'loss') {
          run++;
        } else {
          if (run >= def.minLosses) found = true;
          run = 0;
        }
      }
      return { current: found ? 1 : 0, target: 1, completed: found };
    }
    case 'max_venue_visits': {
      const counts = new Map<string, number>();
      for (const game of finals) {
        if (!matchesFilter(game, def.filter) || game.venueId === null) continue;
        counts.set(game.venueId, (counts.get(game.venueId) ?? 0) + 1);
      }
      const best = counts.size ? Math.max(...counts.values()) : 0;
      return { current: best, target: def.target, completed: best >= def.target };
    }
  }
}

/** Basic structural validation for definitions coming from the client. */
export function validateGoalDefinition(input: unknown, depth = 0): input is GoalDefinition {
  if (depth > 3 || typeof input !== 'object' || input === null) return false;
  const d = input as Record<string, unknown>;
  const okFilter =
    d['filter'] === undefined || (typeof d['filter'] === 'object' && d['filter'] !== null);
  switch (d['type']) {
    case 'count':
    case 'distinct_venues':
    case 'distinct_people':
      return (
        okFilter && typeof d['target'] === 'number' && d['target'] >= 1 && d['target'] <= 10_000
      );
    case 'exists':
      return okFilter;
    case 'record':
      return okFilter && typeof d['min_win_pct'] === 'number' && typeof d['min_games'] === 'number';
    case 'vs_expected':
      return okFilter && typeof d['min'] === 'number';
    case 'all_of':
    case 'any_of':
      return (
        Array.isArray(d['items']) &&
        d['items'].length > 0 &&
        d['items'].length <= 10 &&
        d['items'].every((i) => validateGoalDefinition(i, depth + 1))
      );
    case 'distinct_venues_in_window':
      return (
        okFilter &&
        typeof d['target'] === 'number' &&
        d['target'] >= 1 &&
        typeof d['windowDays'] === 'number' &&
        d['windowDays'] >= 1
      );
    case 'distinct_timezones':
      return okFilter && typeof d['target'] === 'number' && d['target'] >= 1;
    case 'companion_record':
      return (
        okFilter &&
        typeof d['minGames'] === 'number' &&
        d['minGames'] >= 1 &&
        (typeof d['minWinPct'] === 'number' || typeof d['maxWinPct'] === 'number')
      );
    case 'streak_break':
      return okFilter && typeof d['minLosses'] === 'number' && d['minLosses'] >= 1;
    case 'max_venue_visits':
      return okFilter && typeof d['target'] === 'number' && d['target'] >= 1;
    default:
      return false;
  }
}

export interface GoalTemplate {
  key: string;
  title: (n: number) => string;
  defaultN: number;
  build: (
    n: number,
    year: number,
    ctx: { favoriteFranchiseId?: string | undefined },
  ) => GoalDefinition;
}

/** Goal templates (SPEC 6.13). */
export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    key: 'attend_n',
    title: (n) => `Attend ${n} games`,
    defaultN: 10,
    build: (n, year) => ({ type: 'count', target: n, filter: { year } }),
  },
  {
    key: 'new_stadiums',
    title: (n) => `Visit ${n} new venues`,
    defaultN: 2,
    build: (n, year) => ({ type: 'distinct_venues', target: n, filter: { year, new_venue: true } }),
  },
  {
    key: 'team_on_road',
    title: () => 'See your team on the road',
    defaultN: 1,
    build: (_n, year, ctx) => ({
      type: 'exists',
      filter: {
        year,
        venue_not_home: true,
        ...(ctx.favoriteFranchiseId ? { team: ctx.favoriteFranchiseId } : {}),
      },
    }),
  },
  {
    key: 'win_pledges',
    title: (n) => `Win ${n} pledges`,
    defaultN: 3,
    build: (n, year) => ({
      type: 'count',
      target: n,
      filter: { year, rooting_basis: 'pledge', result: 'win' },
    }),
  },
  {
    key: 'beat_expected',
    title: () => 'Beat expected on pledges',
    defaultN: 1,
    build: (_n, year) => ({ type: 'vs_expected', min: 0.5, filter: { year } }),
  },
  {
    key: 'walk_off',
    title: () => 'Witness a walk-off',
    defaultN: 1,
    build: (_n, year) => ({ type: 'count', target: 1, filter: { year, event: 'walk_off' } }),
  },
  {
    key: 'people',
    title: (n) => `Go with ${n} different people`,
    defaultN: 5,
    build: (n, year) => ({ type: 'distinct_people', target: n, filter: { year } }),
  },
  {
    key: 'hr_ballparks',
    title: (n) => `Home runs in ${n} ballparks`,
    defaultN: 5,
    build: (n, year) => ({
      type: 'distinct_venues',
      target: n,
      filter: { year, event: 'home_run', sport: 'mlb' },
    }),
  },
  {
    key: 'arenas',
    title: (n) => `Visit ${n} NBA arenas`,
    defaultN: 3,
    build: (n, year) => ({ type: 'distinct_venues', target: n, filter: { year, sport: 'nba' } }),
  },
  {
    key: 'buzzer_beater',
    title: () => 'See a buzzer-beater',
    defaultN: 1,
    build: (_n, year) => ({
      type: 'count',
      target: 1,
      filter: { year, event: 'buzzer_beater', sport: 'nba' },
    }),
  },
];

/** Suggest a goal from last year's total (SPEC 6.13): about 25% more games, rounded up. */
export function suggestAttendanceGoal(lastYearGames: number): number | null {
  if (lastYearGames <= 0) return null;
  return Math.max(lastYearGames + 1, Math.ceil(lastYearGames * 1.25));
}
