/**
 * Curated franchise players into franchise_players, from seed/franchise_players.json.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/famous/franchise.ts [--check]
 *
 * Dean owns the file. A name resolves to exactly one player or the run refuses: MLB through the
 * Stats API people search (GET v1/people/search?names=&sportIds=1, verified 2026-09-17), NFL
 * through nflverse players.csv, both limited to players active in the entry's seasons. Two
 * people with one name (there are two MLB Will Smiths) need the entry's `id`. The table is
 * replaced as a whole, so a name deleted from the file stops being a star.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { upsertRows, type MinimalDb } from '@jinx/core';

import { createDb } from '../db.js';
import { MlbClient } from '../mlb/client.js';
import {
  ensurePlayers,
  flag,
  loadNflPlayers,
  refreshAllStats,
  type NflPlayerInfo,
} from './players.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const FRANCHISE_FILE = path.join(ROOT, 'seed', 'franchise_players.json');
const SOURCE = 'seed/franchise_players.json';

export interface FranchiseEntry {
  sport: string;
  team?: string | null;
  name: string;
  id?: string;
  from: number;
  to: number | null;
}

interface FranchiseFile {
  transcendent: FranchiseEntry[];
  teams: FranchiseEntry[];
}

/** "Ronald Acuña Jr." and "Ronald Acuna" are the same search. */
export function normName(n: string): string {
  return n
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.'’-]/g, ' ')
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

/** NFL: the players.csv rows with this name who played in [from, to]. */
export function nflCandidates(
  players: Iterable<NflPlayerInfo>,
  e: FranchiseEntry,
): NflPlayerInfo[] {
  const want = normName(e.name);
  const to = e.to ?? 9999;
  return [...players].filter(
    (p) =>
      normName(p.name) === want &&
      (p.rookieSeason == null || p.rookieSeason <= to) &&
      (p.lastSeason == null || p.lastSeason >= e.from),
  );
}

interface MlbSearchPerson {
  id: number;
  fullName: string;
  mlbDebutDate?: string;
  lastPlayedDate?: string;
}

async function mlbCandidates(client: MlbClient, e: FranchiseEntry): Promise<MlbSearchPerson[]> {
  const res = await client.getJson<{ people?: MlbSearchPerson[] }>(
    `v1/people/search?names=${encodeURIComponent(e.name)}&sportIds=1`,
  );
  const to = e.to ?? 9999;
  return (res.people ?? []).filter((p) => {
    const debut = p.mlbDebutDate ? Number(p.mlbDebutDate.slice(0, 4)) : null;
    const last = p.lastPlayedDate ? Number(p.lastPlayedDate.slice(0, 4)) : null;
    return (debut == null || debut <= to) && (last == null || last >= e.from) && debut != null;
  });
}

export async function resolveFranchise(db: MinimalDb, file: FranchiseFile) {
  const entries = [...file.transcendent.map((e) => ({ ...e, team: null })), ...file.teams];
  const { data: teamRows, error } = await db.from('teams').select('id, sport_id, abbreviation');
  if (error) throw new Error(error.message);
  const teams = (teamRows ?? []) as { id: string; sport_id: string; abbreviation: string }[];
  const client = new MlbClient();
  const nfl = entries.some((e) => e.sport === 'nfl' && !e.id)
    ? await loadNflPlayers(() => {})
    : new Map<string, NflPlayerInfo>();

  const errors: string[] = [];
  const out: {
    entry: FranchiseEntry;
    providerPlayerId: string;
    fullName: string;
    teamId: string | null;
  }[] = [];
  for (const e of entries) {
    const at = `${e.sport} ${e.team ?? 'any team'} ${e.name}`;
    let teamId: string | null = null;
    if (e.team) {
      teamId = teams.find((t) => t.sport_id === e.sport && t.abbreviation === e.team)?.id ?? null;
      if (!teamId) {
        errors.push(`${at}: unknown team ${e.team}`);
        continue;
      }
    }
    if (e.id) {
      out.push({ entry: e, providerPlayerId: e.id, fullName: e.name, teamId });
      continue;
    }
    if (e.sport === 'mlb') {
      const c = await mlbCandidates(client, e);
      if (c.length !== 1) {
        errors.push(
          `${at}: ${c.length === 0 ? 'no MLB player by that name in those seasons' : `${c.length} players, add "id": one of ${c.map((p) => `${p.id} (debut ${p.mlbDebutDate})`).join(', ')}`}`,
        );
        continue;
      }
      out.push({ entry: e, providerPlayerId: String(c[0]!.id), fullName: c[0]!.fullName, teamId });
    } else if (e.sport === 'nfl') {
      const c = nflCandidates(nfl.values(), e);
      if (c.length !== 1) {
        errors.push(
          `${at}: ${c.length === 0 ? 'no NFL player by that name in those seasons' : `${c.length} players, add "id": one of ${c.map((p) => `${p.gsisId} (${p.position}, ${p.rookieSeason})`).join(', ')}`}`,
        );
        continue;
      }
      out.push({ entry: e, providerPlayerId: c[0]!.gsisId, fullName: c[0]!.name, teamId });
    } else {
      errors.push(`${at}: unknown sport`);
    }
  }
  if (errors.length > 0)
    throw new Error(`refusing to load seed/franchise_players.json:\n  ${errors.join('\n  ')}`);
  return out;
}

async function main(): Promise<void> {
  const file = JSON.parse(readFileSync(FRANCHISE_FILE, 'utf8')) as FranchiseFile;
  const db = createDb();
  const resolved = await resolveFranchise(db, file);
  for (const r of resolved)
    console.log(
      `${r.entry.sport} ${r.entry.team ?? '*'} ${r.fullName} (${r.providerPlayerId}) ${r.entry.from}-${r.entry.to ?? 'now'}`,
    );
  if (flag('check')) {
    console.log(`${resolved.length} entries resolve (--check: nothing written)`);
    return;
  }
  const ids = new Map<string, string>();
  for (const sport of ['mlb', 'nfl']) {
    const provider = sport === 'mlb' ? 'mlb' : 'nflverse';
    const m = await ensurePlayers(
      db,
      sport,
      provider,
      resolved
        .filter((r) => r.entry.sport === sport)
        .map((r) => ({ providerPlayerId: r.providerPlayerId, fullName: r.fullName })),
    );
    for (const [k, v] of m) ids.set(`${sport}:${k}`, v);
  }
  const { error } = await db.from('franchise_players').delete().eq('source', SOURCE);
  if (error) throw new Error(`clear franchise_players: ${error.message}`);
  await upsertRows(
    db,
    'franchise_players',
    resolved.map((r) => ({
      player_id: ids.get(`${r.entry.sport}:${r.providerPlayerId}`)!,
      team_id: r.teamId,
      from_season: r.entry.from,
      to_season: r.entry.to,
      source: SOURCE,
    })),
    'id',
  );
  console.log(`${resolved.length} franchise players loaded`);
  await refreshAllStats(db);
}

const isEntrypoint = process.argv[1] != null && /[\\/]franchise\.ts$/.test(process.argv[1]);
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
