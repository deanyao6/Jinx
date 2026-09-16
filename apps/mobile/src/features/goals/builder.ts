/**
 * Goal construction for the app (SPEC.md 6.13): templates and the custom builder both produce a
 * `GoalDefinition` that core's evaluator understands. Pure, so it is unit tested.
 */
import {
  GOAL_TEMPLATES,
  suggestAttendanceGoal,
  validateGoalDefinition,
  type GoalDefinition,
  type GoalFilter,
  type GoalProgress,
  type GoalTemplate,
  type Sport,
} from '@jinx/core';

import { momentLabel } from '@/features/attendances/moments';

export type GoalSource = 'template' | 'custom' | 'suggested';

export type GoalDraft = { title: string; definition: GoalDefinition; source: GoalSource };

/** Template keys whose title and target depend on a number the user picks. */
export const TEMPLATES_WITH_N = new Set([
  'attend_n',
  'new_stadiums',
  'win_pledges',
  'people',
  'hr_ballparks',
]);

export function templateByKey(key: string): GoalTemplate | undefined {
  return GOAL_TEMPLATES.find((t) => t.key === key);
}

export function templateNeedsN(key: string): boolean {
  return TEMPLATES_WITH_N.has(key);
}

export function buildTemplateGoal(
  key: string,
  n: number,
  year: number,
  ctx: { favoriteFranchiseId?: string | undefined } = {},
): GoalDraft | null {
  const t = templateByKey(key);
  if (!t) return null;
  const count = templateNeedsN(key) ? Math.max(1, Math.round(n)) : t.defaultN;
  const definition = t.build(count, year, ctx);
  if (!validateGoalDefinition(definition)) return null;
  return { title: t.title(count), definition, source: 'template' };
}

/** "You went to 14 games last year. Try 18?" */
export function buildSuggestedGoal(lastYearGames: number, year: number): GoalDraft | null {
  const n = suggestAttendanceGoal(lastYearGames);
  if (n === null) return null;
  const draft = buildTemplateGoal('attend_n', n, year);
  return draft ? { ...draft, source: 'suggested' } : null;
}

export type CustomGoalType = 'count' | 'distinct_venues' | 'exists';

export type CustomGoalInput = {
  type: CustomGoalType;
  target: number;
  sport: Sport | null;
  event: string | null;
  /** Franchise id of "your team". */
  team: string | null;
  teamName?: string | null;
  road: boolean;
  newVenue: boolean;
};

export const EMPTY_CUSTOM_GOAL: CustomGoalInput = {
  type: 'count',
  target: 5,
  sport: null,
  event: null,
  team: null,
  teamName: null,
  road: false,
  newVenue: false,
};

export function customGoalFilter(input: CustomGoalInput, year: number): GoalFilter {
  const f: GoalFilter = { year };
  if (input.sport) f.sport = input.sport;
  if (input.event) f.event = input.event;
  if (input.team) f.team = input.team;
  if (input.road) f.venue_not_home = true;
  if (input.newVenue) f.new_venue = true;
  return f;
}

function sportWord(sport: Sport | null, plural: boolean): string {
  if (sport === 'mlb') return plural ? 'MLB games' : 'an MLB game';
  if (sport === 'nfl') return plural ? 'NFL games' : 'an NFL game';
  return plural ? 'games' : 'a game';
}

function venueWord(sport: Sport | null, n: number): string {
  const one = sport === 'mlb' ? 'ballpark' : 'stadium';
  return `${n} ${n === 1 ? one : `${one}s`}`;
}

export function customGoalTitle(input: CustomGoalInput): string {
  const qualifiers: string[] = [];
  if (input.event) qualifiers.push(`with a ${momentLabel(input.event).toLowerCase()}`);
  if (input.team) qualifiers.push(`rooting for the ${input.teamName ?? 'team you picked'}`);
  if (input.road) qualifiers.push('on the road');
  const tail = qualifiers.length ? ` ${qualifiers.join(', ')}` : '';
  const target = Math.max(1, Math.round(input.target));
  switch (input.type) {
    case 'count':
      return `Attend ${target} ${input.newVenue ? 'new-stadium ' : ''}${sportWord(input.sport, true)}${tail}`;
    case 'distinct_venues':
      return `${input.newVenue ? 'New ' : ''}${input.sport === 'mlb' ? 'Ballparks' : 'Stadiums'}: ${venueWord(input.sport, target)}${tail}`;
    case 'exists':
      return `See ${input.newVenue ? 'a new stadium at ' : ''}${sportWord(input.sport, false)}${tail}`;
  }
}

export function buildCustomGoal(
  input: CustomGoalInput,
  year: number,
  title?: string,
): GoalDraft | null {
  const filter = customGoalFilter(input, year);
  const target = Math.max(1, Math.round(input.target));
  const definition: GoalDefinition =
    input.type === 'exists' ? { type: 'exists', filter } : { type: input.type, target, filter };
  if (!validateGoalDefinition(definition)) return null;
  const finalTitle = (title ?? '').trim() || customGoalTitle(input);
  return { title: finalTitle, definition, source: 'custom' };
}

/** "3 of 5", "Not yet", "Done". */
export function progressLabel(p: GoalProgress, def: GoalDefinition): string {
  if (p.completed) return 'Done';
  if (def.type === 'exists' || def.type === 'any_of') return 'Not yet';
  if (def.type === 'vs_expected')
    return `${p.current >= 0 ? '+' : ''}${p.current.toFixed(1)} of +${p.target}`;
  if (p.current === 0) return 'Not yet';
  return `${p.current} of ${p.target}`;
}

export function progressRatio(p: GoalProgress): number {
  if (p.completed) return 1;
  if (p.target <= 0) return 0;
  return Math.max(0, Math.min(1, p.current / p.target));
}

/** Definitions are equal when their JSON is, ignoring key order. */
export function sameDefinition(a: unknown, b: unknown): boolean {
  return stableJson(a) === stableJson(b);
}

function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

export { stableJson };
