/**
 * Writes one team's current roster to `team_rosters` (migration 20260917000900).
 *
 * Shared by the MLB and NFL roster scripts. Players are matched by (provider, provider id) and
 * upserted first, so a new arrival the detail pipeline has never seen gets a `players` row and
 * a name; the roster rows are then upserted for (team, season) and anyone the provider no
 * longer lists for that team and season is deleted. Idempotent: a rerun with the same input
 * changes nothing but `updated_at`.
 */
import type { RosterEntry, Sport } from '../types.js';
import { chunk, upsertRows, type MinimalDb } from './db.js';

export interface RosterWrite {
  provider: string;
  sport: Sport;
  /** teams.id */
  teamId: string;
  season: number;
  entries: RosterEntry[];
}

export interface RosterWriteResult {
  written: number;
  removed: number;
  /** Players inserted into `players` because they were new to the provider. */
  newPlayers: number;
}

function dedupe(entries: RosterEntry[]): RosterEntry[] {
  const byId = new Map<string, RosterEntry>();
  for (const e of entries) if (!byId.has(e.providerPlayerId)) byId.set(e.providerPlayerId, e);
  return [...byId.values()];
}

async function playerIds(
  db: MinimalDb,
  provider: string,
  providerPlayerIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const part of chunk(providerPlayerIds, 500)) {
    const { data, error } = await db
      .from('players')
      .select('id, provider_player_id')
      .eq('provider', provider)
      .in('provider_player_id', part);
    if (error) throw new Error(`players lookup: ${error.message}`);
    for (const p of (data ?? []) as { id: string; provider_player_id: string }[])
      out.set(p.provider_player_id, p.id);
  }
  return out;
}

export async function upsertTeamRoster(
  db: MinimalDb,
  write: RosterWrite,
): Promise<RosterWriteResult> {
  const entries = dedupe(write.entries);
  const ids = entries.map((e) => e.providerPlayerId);

  const before = await playerIds(db, write.provider, ids);
  // ignoreDuplicates: a player already known keeps the name the detail pipeline gave them;
  // the roster only introduces people it has never met.
  await upsertRows(
    db,
    'players',
    entries
      .filter((e) => !before.has(e.providerPlayerId))
      .map((e) => ({
        sport_id: write.sport,
        full_name: e.fullName,
        provider: write.provider,
        provider_player_id: e.providerPlayerId,
      })),
    'provider,provider_player_id',
    { ignoreDuplicates: true },
  );
  const byProvider = await playerIds(db, write.provider, ids);
  const missing = ids.filter((id) => !byProvider.has(id));
  if (missing.length > 0) {
    throw new Error(`players missing after upsert: ${missing.slice(0, 5).join(', ')}`);
  }

  const now = new Date().toISOString();
  const rows = entries.map((e) => ({
    team_id: write.teamId,
    player_id: byProvider.get(e.providerPlayerId)!,
    season: write.season,
    position: e.position,
    jersey: e.jersey,
    status: e.status,
    updated_at: now,
  }));
  await upsertRows(db, 'team_rosters', rows, 'team_id,player_id,season');

  // Whoever was on this team's roster for the season and is not any more.
  const { data: existing, error } = await db
    .from('team_rosters')
    .select('player_id')
    .eq('team_id', write.teamId)
    .eq('season', write.season);
  if (error) throw new Error(`team_rosters select: ${error.message}`);
  const keep = new Set(rows.map((r) => r.player_id));
  const stale = ((existing ?? []) as { player_id: string }[])
    .map((r) => r.player_id)
    .filter((id) => !keep.has(id));
  for (const part of chunk(stale, 200)) {
    const { error: delErr } = await db
      .from('team_rosters')
      .delete()
      .eq('team_id', write.teamId)
      .eq('season', write.season)
      .in('player_id', part);
    if (delErr) throw new Error(`team_rosters delete: ${delErr.message}`);
  }

  return { written: rows.length, removed: stale.length, newPlayers: ids.length - before.size };
}
