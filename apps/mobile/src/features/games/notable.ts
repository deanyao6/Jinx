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
 * - `game_story_steps` holds every SCORING PLAY, and nflverse names the scorer on each, so
 *   an ordinary touchdown or field goal is named. MLB's feed describes a scoring play in
 *   prose with no player id, which is why its home runs come from the first source.
 *
 * Together they answer what was actually asked for: who scored a touchdown or hit a home
 * run. "Star player" in the wider sense — an all-star, a franchise great — is deliberately
 * not attempted. Nothing in this database ranks players: `game_appearances` is (game,
 * player, team) and nothing else, and `players` carries no stature. Inferring it from a
 * name would be a guess dressed as a fact.
 */
export type NotablePlayer = {
  playerId: string;
  name: string;
  /** "Home run", "Pick six · 42 yards" — what they did, from game_events. */
  did: string;
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
  // also describe it.
  for (const step of steps) {
    if (step.scorerId) add(step.scorerId, 'Scored');
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
    const did = didByPlayer.get(row.player.id);
    if (did)
      group.notable.push({
        playerId: row.player.id,
        name: row.player.full_name,
        did: did.join(', '),
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

/** "and 23 others", or nothing at all when everyone who played is already named. */
export function othersLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? 'and 1 other player' : `and ${count} other players`;
}
