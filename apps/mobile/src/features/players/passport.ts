/**
 * Favourite players on the Passport: turns `favorite_players_seen` rows into list items.
 *
 * The RPC returns one row per favourite per team they were seen playing for, so a traded player
 * counts under each team's pill. All teams adds those up and also lists favourites never seen,
 * because "not seen yet" is the reason to go to a game. A team pill lists only the favourites
 * seen playing for that team: a Mets pill showing a player you have only seen as a Phillie
 * would be wrong.
 */

export type FavoritePlayerSeenRow = {
  player_id: string;
  full_name: string;
  sport_id: string;
  team_id: string | null;
  seen: number;
  last_seen: string | null;
  last_game_id: string | null;
};

export type FavoritePlayerItem = {
  playerId: string;
  name: string;
  /** "Seen 9 times", or "Not seen yet". */
  seenLine: string;
  /** "Last Jun 1, 2025", or empty when never seen. */
  chip: string;
  seen: number;
  /** The most recent game you saw them in, for the row to open. */
  lastGameId: string | null;
};

export function seenLine(seen: number): string {
  if (seen === 0) return 'Not seen yet';
  return seen === 1 ? 'Seen once' : `Seen ${seen} times`;
}

export function favoritePlayerItems(
  rows: readonly FavoritePlayerSeenRow[],
  pill: string,
  formatDate: (iso: string) => string,
): FavoritePlayerItem[] {
  const byPlayer = new Map<
    string,
    { name: string; seen: number; lastSeen: string | null; lastGameId: string | null }
  >();
  for (const row of rows) {
    if (pill !== 'all' && row.team_id !== pill) continue;
    const entry = byPlayer.get(row.player_id) ?? {
      name: row.full_name,
      seen: 0,
      lastSeen: null,
      lastGameId: null,
    };
    entry.seen += row.seen;
    if (row.last_seen && (!entry.lastSeen || row.last_seen > entry.lastSeen)) {
      entry.lastSeen = row.last_seen;
      entry.lastGameId = row.last_game_id;
    }
    byPlayer.set(row.player_id, entry);
  }

  return [...byPlayer.entries()]
    .filter(([, p]) => pill === 'all' || p.seen > 0)
    .map(([playerId, p]) => ({
      playerId,
      name: p.name,
      seenLine: seenLine(p.seen),
      chip: p.lastSeen ? `Last ${formatDate(p.lastSeen)}` : '',
      seen: p.seen,
      lastGameId: p.lastGameId,
    }))
    .sort((a, b) => b.seen - a.seen || a.name.localeCompare(b.name));
}
