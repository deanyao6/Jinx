import { momentDetail, momentLabel } from '@/features/attendances/moments';
import type { ReliveStep } from '@/features/data/shapes';

import type { AppearanceRow, GameEventRow } from './queries';

/**
 * Who to name under "Players seen", and who to count (SPEC.md 6.7).
 *
 * The card used to print every player who appeared — both full rosters, 50-odd names in a
 * grey run-on line that nobody reads. What a fan remembers is who *did* something, so the
 * named players are the ones who did. The rest become a count, and stay one tap away.
 *
 * Two sources, because neither covers both sports:
 *
 * - `game_events` holds the RARE moments (SPEC.md 6.7) — a pick six, a 50-yard field goal,
 *   a home run, a no-hitter. MLB's carry their player; NFL's now do too.
 * - `game_story_steps` holds every SCORING PLAY with its scorer by the rule in
 *   `@jinx/core` scoring.ts: the touchdown scorer, the field goal kicker, the batter with
 *   the RBI. An extra point names nobody, so a kicker is named for his field goals only.
 *
 * Together they answer what was actually asked for: who scored a touchdown or hit a home
 * run. Since famous games (docs/prompts/famous-games.md 3) there is a third source: the
 * superstars who appeared, from `game_stars`, each named with the honor that makes them one
 * ("2024 All-Star", "MVP 2023"). Stature comes from awards and a curated list, never from a
 * name. An ordinary RBI ("Drove in a run") is left out unless the batter is a star: on a big
 * night it named half the lineup.
 */
export type NotablePlayer = {
  playerId: string;
  name: string;
  /** "Home run", "Pick six · 42 yards" — what they did, from game_events. Empty for a star who did nothing notable. */
  did: string;
  /** "2024 All-Star": why this player is a star, when they are one. */
  honor?: string;
};

export type TeamPlayers = {
  teamId: string;
  notable: NotablePlayer[];
  /** Everyone else who appeared, alphabetical, for the expanded list. */
  others: string[];
};

/**
 * Group one game's appearances by team, pulling out the players with a moment.
 *
 * A player with more than one moment is named once, with their moments joined, so a
 * two-homer night is one row and not two.
 */
export function notablePlayers(
  appearances: readonly AppearanceRow[],
  events: readonly GameEventRow[],
  steps: readonly ReliveStep[] = [],
  /** playerId -> the honor caption, for the superstars who appeared (`game_stars`). */
  stars: ReadonlyMap<string, string> = new Map(),
): TeamPlayers[] {
  // playerId -> the things they did, in the order they happened.
  const didByPlayer = new Map<string, string[]>();
  const add = (id: string, label: string) => {
    const list = didByPlayer.get(id) ?? [];
    // The same thing can be recorded twice for one player — a moment that is also a scoring
    // play, or two identical plays. Say it once.
    if (!list.includes(label)) list.push(label);
    didByPlayer.set(id, list);
  };

  // Scoring plays first, so an ordinary touchdown reads before the rarer moment that may
  // also describe it. The step's kind says what it was; a step from before kinds were
  // stored just says they scored.
  for (const step of steps) {
    if (step.scorerId) add(step.scorerId, scoredLabel(step.kind ?? null));
  }
  for (const e of events) {
    const id = e.player?.id;
    if (!id) continue;
    const detail = momentDetail(e.type, e.detail ?? {});
    add(id, detail ? `${momentLabel(e.type)} · ${detail}` : momentLabel(e.type));
  }

  const byTeam = new Map<string, TeamPlayers>();
  for (const row of appearances) {
    if (!row.player) continue;
    const group = byTeam.get(row.team_id) ?? { teamId: row.team_id, notable: [], others: [] };
    const honor = stars.get(row.player.id);
    const all = didByPlayer.get(row.player.id) ?? [];
    // A star keeps everything they did; anyone else loses the ordinary RBI.
    const did = honor ? all : all.filter((d) => !QUIET_UNLESS_STAR.has(d));
    if (did.length > 0 || honor)
      group.notable.push({
        playerId: row.player.id,
        name: row.player.full_name,
        did: did.join(', '),
        ...(honor ? { honor } : {}),
      });
    else group.others.push(row.player.full_name);
    byTeam.set(row.team_id, group);
  }

  for (const group of byTeam.values()) {
    group.notable.sort((a, b) => a.name.localeCompare(b.name));
    group.others.sort((a, b) => a.localeCompare(b));
  }
  return [...byTeam.values()];
}

/** Lines too ordinary to name a player for, unless that player is a star. */
const QUIET_UNLESS_STAR: ReadonlySet<string> = new Set(['Drove in a run']);

/** What a scoring step says a player did: "Touchdown", "Home run", "Drove in a run". */
const SCORED_LABEL: Record<string, string> = {
  touchdown: 'Touchdown',
  field_goal: 'Field goal',
  home_run: 'Home run',
  single: 'Drove in a run',
  double: 'Drove in a run',
  triple: 'Drove in a run',
  sac_fly: 'Drove in a run',
  sac_bunt: 'Drove in a run',
  walk: 'Drove in a run',
  hit_by_pitch: 'Drove in a run',
  groundout: 'Drove in a run',
  flyout: 'Drove in a run',
  fielders_choice: 'Drove in a run',
  steal: 'Stole home',
};

export function scoredLabel(kind: string | null): string {
  return (kind && SCORED_LABEL[kind]) || 'Scored';
}

/** "and 23 others", or nothing at all when everyone who played is already named. */
export function othersLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? 'and 1 other player' : `and ${count} other players`;
}
