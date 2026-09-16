/** Bucket-list predicates share the goal evaluator, without a year (SPEC.md 6.14). Pure. */
import {
  evaluateGoal,
  matchesFilter,
  validateGoalDefinition,
  type GoalDefinition,
  type GoalGame,
  type GoalProgress,
} from '@appname/core';

export function parseDefinition(def: unknown): GoalDefinition | null {
  return validateGoalDefinition(def) ? def : null;
}

export function bucketListProgress(
  def: GoalDefinition | null,
  games: GoalGame[],
): GoalProgress | null {
  return def ? evaluateGoal(def, games) : null;
}

/** "21 of 30", or "Done" / "Not yet" for achievement lists. */
export function bucketProgressLabel(p: GoalProgress | null, def: GoalDefinition | null): string {
  if (!p || !def) return '';
  if (p.completed) return 'Done';
  if (def.type === 'exists' || def.type === 'any_of') return 'Not yet';
  return `${p.current} of ${p.target}`;
}

/** Venue ids a distinct_venues list is about, or [] for achievement lists. */
export function listVenueIds(def: GoalDefinition | null): string[] {
  if (!def) return [];
  if (def.type === 'distinct_venues') return def.filter?.venue_ids ?? [];
  if (def.type === 'all_of' || def.type === 'any_of') return def.items.flatMap(listVenueIds);
  return [];
}

/** Venue ids from the list that the user has a final game at, matching the list's filter. */
export function visitedListVenues(def: GoalDefinition | null, games: GoalGame[]): Set<string> {
  const visited = new Set<string>();
  if (!def || def.type !== 'distinct_venues') return visited;
  for (const g of games) {
    if (!g.isFinal || g.venueId === null) continue;
    if (matchesFilter(g, def.filter)) visited.add(g.venueId);
  }
  return visited;
}

/** Final games that count toward an achievement-style list (exists / count). */
export function matchingGames(def: GoalDefinition | null, games: GoalGame[]): GoalGame[] {
  if (!def || !('filter' in def)) return [];
  return games.filter((g) => g.isFinal && matchesFilter(g, def.filter));
}
