import { momentDetail, momentLabel } from '@/features/attendances/moments';
import type { AppearanceRow, GameEventRow } from './queries';

/**
 * Who to name under "Players seen", and who to count (SPEC.md 6.7).
 *
 * The card used to print every player who appeared — both full rosters, 50-odd names in a
 * grey run-on line that nobody reads. What a fan remembers is who *did* something, so the
 * named players are the ones with a moment in this game: a home run, a pick six, a
 * walk-off. The rest become a count, and stay one tap away.
 *
 * "Star player" in the wider sense — an all-star, a franchise great — is deliberately not
 * attempted. Nothing in this database ranks players: `game_appearances` is (game, player,
 * team) and nothing else, and `players` carries no stature. Inferring it from a name would
 * be a guess dressed as a fact. So notability here means "did something in the game you
 * were at", which the data does know.
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
): TeamPlayers[] {
  // playerId -> the things they did, in the order the moments happened.
  const didByPlayer = new Map<string, string[]>();
  for (const e of events) {
    const id = e.player?.id;
    if (!id) continue;
    const detail = momentDetail(e.type, e.detail ?? {});
    const label = detail ? `${momentLabel(e.type)} · ${detail}` : momentLabel(e.type);
    const list = didByPlayer.get(id) ?? [];
    // A game can record the same moment type twice for one player; say it once.
    if (!list.includes(label)) list.push(label);
    didByPlayer.set(id, list);
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
