/**
 * Curated franchise players into franchise_players, from seed/franchise_players.json.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/famous/franchise.ts [--check]
 *
 * Dean owns the file. A name resolves to exactly one player or the run refuses: MLB through the
 * Stats API people search (GET v1/people/search?names=&sportIds=1, verified 2026-09-17), NFL
 * through nflverse players.csv, the NBA through stats.nba.com commonallplayers (every player
 * ever, with first and last seasons), all three limited to players active in the entry's
 * seasons; MLS through ESPN's search (apis/search/v2, soccer athletes only, verified
 * 2026-09-22), which knows no seasons, so a name with two soccer records needs the `id`. Two
 * people with one name (there are two MLB Will Smiths) need the entry's `id`. The table is
 * replaced as a whole, so a name deleted from the file stops being a star.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NbaClient, STATS_BASE, upsertRows, type MinimalDb } from '@jinx/core';

import { createDb } from '../db.js';
import { MlbClient } from '../mlb/client.js';
import { diskCache } from '../nba/cache.js';
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

export interface NbaPlayerInfo {
  personId: string;
  name: string;
  fromYear: number | null;
  toYear: number | null;
}

/** Every NBA player ever, from commonallplayers (5,227 rows on 2026-09-22), cached for a day. */
export async function loadNbaPlayers(): Promise<NbaPlayerInfo[]> {
  const client = new NbaClient({ cache: diskCache() });
  const res = await client.getJson<{ resultSets: { headers: string[]; rowSet: unknown[][] }[] }>(
    `${STATS_BASE}commonallplayers?LeagueID=00&Season=2025-26&IsOnlyCurrentSeason=0`,
    {
      host: 'nba',
      cacheKey: 'commonallplayers_all',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        accept: 'application/json, text/plain, */*',
        referer: 'https://www.nba.com/',
        origin: 'https://www.nba.com',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true',
      },
    },
  );
  const rs = res.resultSets[0]!;
  const col = (name: string) => rs.headers.indexOf(name);
  const id = col('PERSON_ID');
  const name = col('DISPLAY_FIRST_LAST');
  const from = col('FROM_YEAR');
  const to = col('TO_YEAR');
  return rs.rowSet.map((r) => ({
    personId: String(r[id]),
    name: String(r[name]),
    fromYear: r[from] == null ? null : Number(r[from]),
    toYear: r[to] == null ? null : Number(r[to]),
  }));
}

/** NBA: the commonallplayers rows with this name whose career overlaps [from, to]. */
export function nbaCandidates(players: Iterable<NbaPlayerInfo>, e: FranchiseEntry): NbaPlayerInfo[] {
  const want = normName(e.name);
  const to = e.to ?? 9999;
  return [...players].filter(
    (p) =>
      normName(p.name) === want &&
      (p.fromYear == null || p.fromYear <= to) &&
      (p.toYear == null || p.toYear >= e.from),
  );
}

export interface EspnAthlete {
  id: string;
  name: string;
  /** The last club ESPN saw the player with, and the last competition. */
  club: string | null;
  competition: string | null;
}

interface EspnSearch {
  results?: { type?: string; contents?: { uid?: string; displayName?: string; subtitle?: string; description?: string }[] }[];
}

/** The soccer athletes (uid s:600~a:<id>) ESPN's search returns for a name. */
export function espnSoccerAthletes(res: EspnSearch, name: string): EspnAthlete[] {
  const want = normName(name);
  const out: EspnAthlete[] = [];
  for (const r of res.results ?? []) {
    if (r.type !== 'player') continue;
    for (const c of r.contents ?? []) {
      const m = /^s:600~a:(\d+)$/.exec(c.uid ?? '');
      if (!m || normName(c.displayName ?? '') !== want) continue;
      out.push({ id: m[1]!, name: c.displayName ?? name, club: c.subtitle ?? null, competition: c.description ?? null });
    }
  }
  return out;
}

async function mlsCandidates(e: FranchiseEntry): Promise<EspnAthlete[]> {
  const res = await fetch(
    `https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(e.name)}&limit=10`,
  );
  if (!res.ok) throw new Error(`ESPN search ${res.status} for ${e.name}`);
  return espnSoccerAthletes((await res.json()) as EspnSearch, e.name);
}

const PROVIDER: Record<string, string> = { mlb: 'mlb', nfl: 'nflverse', nba: 'nba', mls: 'espn_mls' };

export async function resolveFranchise(db: MinimalDb, file: FranchiseFile) {
  const entries = [...file.transcendent.map((e) => ({ ...e, team: null })), ...file.teams];
  const { data: teamRows, error } = await db.from('teams').select('id, sport_id, abbreviation');
  if (error) throw new Error(error.message);
  const teams = (teamRows ?? []) as { id: string; sport_id: string; abbreviation: string }[];
  const client = new MlbClient();
  const nfl = entries.some((e) => e.sport === 'nfl' && !e.id)
    ? await loadNflPlayers(() => {})
    : new Map<string, NflPlayerInfo>();
  const nba = entries.some((e) => e.sport === 'nba' && !e.id) ? await loadNbaPlayers() : [];

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
    } else if (e.sport === 'nba') {
      const c = nbaCandidates(nba, e);
      if (c.length !== 1) {
        errors.push(
          `${at}: ${c.length === 0 ? 'no NBA player by that name in those seasons' : `${c.length} players, add "id": one of ${c.map((p) => `${p.personId} (${p.fromYear}-${p.toYear})`).join(', ')}`}`,
        );
        continue;
      }
      out.push({ entry: e, providerPlayerId: c[0]!.personId, fullName: c[0]!.name, teamId });
    } else if (e.sport === 'mls') {
      const c = await mlsCandidates(e);
      if (c.length !== 1) {
        errors.push(
          `${at}: ${c.length === 0 ? 'no soccer player by that name on ESPN' : `${c.length} players, add "id": one of ${c.map((p) => `${p.id} (${p.club ?? '?'}, ${p.competition ?? '?'})`).join(', ')}`}`,
        );
        continue;
      }
      out.push({ entry: e, providerPlayerId: c[0]!.id, fullName: c[0]!.name, teamId });
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
  for (const sport of Object.keys(PROVIDER)) {
    const provider = PROVIDER[sport]!;
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
