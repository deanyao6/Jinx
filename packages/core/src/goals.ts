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
}

export type GoalDefinition =
  | { type: 'count'; target: number; filter?: GoalFilter }
  | { type: 'distinct_venues'; target: number; filter?: GoalFilter }
  | { type: 'distinct_people'; target: number; filter?: GoalFilter }
  | { type: 'exists'; filter?: GoalFilter }
  | { type: 'record'; filter?: GoalFilter; min_win_pct: number; min_games: number }
  | { type: 'vs_expected'; min: number; filter?: GoalFilter }
  | { type: 'all_of'; items: GoalDefinition[] }
  | { type: 'any_of'; items: GoalDefinition[] };

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
