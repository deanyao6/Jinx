/**
 * Shared by the famous-games ingest scripts: make sure a player row exists for every provider id
 * a source names, and read the nflverse players file (names, rookie seasons).
 */
import { chunk, upsertRows, type MinimalDb } from '@jinx/core';

import { fetchAsset, openAsset, playersAsset } from '../nfl/assets.js';
import { readCsv, str, num } from '../nfl/csv.js';

export interface NamedPlayer {
  providerPlayerId: string;
  fullName: string;
}

/**
 * provider id -> players.id, creating a row for anyone not yet known. A player already known
 * keeps the name the detail pipeline gave them (ignoreDuplicates), the same rule as the roster
 * writer in packages/core/src/ingest/rosters.ts.
 */
export async function ensurePlayers(
  db: MinimalDb,
  sport: string,
  provider: string,
  players: readonly NamedPlayer[],
): Promise<Map<string, string>> {
  const byId = new Map<string, NamedPlayer>();
  for (const p of players) if (p.providerPlayerId) byId.set(p.providerPlayerId, p);
  const ids = [...byId.keys()];
  const out = await playerIds(db, provider, ids);
  const missing = ids.filter((id) => !out.has(id));
  if (missing.length > 0) {
    await upsertRows(
      db,
      'players',
      missing.map((id) => ({
        sport_id: sport,
        full_name: byId.get(id)!.fullName,
        provider,
        provider_player_id: id,
      })),
      'provider,provider_player_id',
      { ignoreDuplicates: true },
    );
    for (const [k, v] of await playerIds(db, provider, missing)) out.set(k, v);
  }
  const still = ids.filter((id) => !out.has(id));
  if (still.length > 0)
    throw new Error(`players missing after upsert: ${still.slice(0, 5).join(', ')}`);
  return out;
}

export async function playerIds(
  db: MinimalDb,
  provider: string,
  ids: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const part of chunk([...ids], 500)) {
    if (part.length === 0) continue;
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

export interface NflPlayerInfo {
  gsisId: string;
  name: string;
  position: string | null;
  rookieSeason: number | null;
  lastSeason: number | null;
}

/** Every player in nflverse players.csv with a gsis id, through the ETag cache. */
export async function loadNflPlayers(
  log: (s: string) => void = console.log,
): Promise<Map<string, NflPlayerInfo>> {
  const fetched = await fetchAsset(playersAsset(), { log });
  log(`  players.csv.gz: ${fetched.source}`);
  const out = new Map<string, NflPlayerInfo>();
  for await (const r of readCsv(openAsset(fetched.path))) {
    const gsisId = str(r, 'gsis_id');
    const name = str(r, 'display_name');
    if (!gsisId || !name) continue;
    out.set(gsisId, {
      gsisId,
      name,
      position: str(r, 'position'),
      rookieSeason: num(r, 'rookie_season'),
      lastSeason: num(r, 'last_season'),
    });
  }
  return out;
}

/** Service-role recompute of every cached stats payload, after anything that moves a badge. */
export async function refreshAllStats(
  db: MinimalDb,
  log: (s: string) => void = console.log,
): Promise<void> {
  const { data, error } = await db.rpc('refresh_all_user_stats');
  if (error) throw new Error(`refresh_all_user_stats: ${error.message}`);
  log(`refreshed ${String(data)} cached stats payloads`);
}

/** A tiny argv reader shared by the scripts in this folder. */
export function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith('--')
    ? process.argv[i + 1]!
    : null;
}

export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
