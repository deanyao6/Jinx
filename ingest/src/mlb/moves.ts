/**
 * MLB joins into player_moves, for "Saw {name}'s first days as a {Nickname}".
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/mlb/moves.ts [--from 2016-01-01 --to 2026-09-17]
 *
 * GET v1/transactions?teamId=&startDate=&endDate= per active team, one request per team per
 * calendar year of the range (verified 2026-09-17). A join is a trade, a signing, a waiver
 * claim, a Rule 5 pick or a purchase whose destination is that team (`mlbJoins`); recalls and
 * contract selections are not joins. Defaults to the last 30 days. Idempotent.
 */
import { mlbJoins, selectAll, upsertRows, type MlbJoin } from '@jinx/core';

import { createDb } from '../db.js';
import { arg, ensurePlayers, refreshAllStats } from '../famous/players.js';
import { MlbClient } from './client.js';

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** [from, to] split at year ends, so no single request spans more than a year. */
export function yearRanges(from: string, to: string): [string, string][] {
  const out: [string, string][] = [];
  let start = from;
  while (start <= to) {
    const yearEnd = `${start.slice(0, 4)}-12-31`;
    const end = yearEnd < to ? yearEnd : to;
    out.push([start, end]);
    start = `${Number(start.slice(0, 4)) + 1}-01-01`;
  }
  return out;
}

async function main(): Promise<void> {
  const today = new Date();
  const from = arg('from') ?? isoDay(new Date(today.getTime() - 30 * 86_400_000));
  const to = arg('to') ?? isoDay(today);
  const db = createDb();
  const client = new MlbClient();

  const teams = await selectAll<{ id: string; provider_team_id: string; abbreviation: string }>(
    db,
    'teams',
    'id, provider_team_id, abbreviation',
    (q) => q.eq('provider', 'mlb'),
  );
  const teamByProvider = new Map(teams.map((t) => [t.provider_team_id, t.id]));

  const joins: MlbJoin[] = [];
  let failures = 0;
  for (const t of teams.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation))) {
    try {
      let n = 0;
      for (const [start, end] of yearRanges(from, to)) {
        const res = await client.transactions(t.provider_team_id, start, end);
        const found = mlbJoins(res.transactions ?? [], (id) => teamByProvider.has(id));
        joins.push(...found);
        n += found.length;
      }
      console.log(`${t.abbreviation}: ${n} joins`);
    } catch (err) {
      failures += 1;
      console.error(`${t.abbreviation}: ${String(err)}`);
    }
  }

  const ids = await ensurePlayers(
    db,
    'mlb',
    'mlb',
    joins.map((j) => ({
      providerPlayerId: j.providerPlayerId,
      fullName: j.fullName ?? `Player ${j.providerPlayerId}`,
    })),
  );
  const rows = new Map<string, Record<string, unknown>>();
  for (const j of joins) {
    const playerId = ids.get(j.providerPlayerId)!;
    const teamId = teamByProvider.get(j.providerTeamId)!;
    rows.set(`${playerId}:${teamId}:${j.joinedOn}`, {
      player_id: playerId,
      team_id: teamId,
      joined_on: j.joinedOn,
      kind: j.kind,
      source: 'mlb-statsapi',
    });
  }
  await upsertRows(db, 'player_moves', [...rows.values()], 'player_id,team_id,joined_on');
  console.log(`${rows.size} moves from ${from} to ${to}`);
  await refreshAllStats(db);
  if (failures > 0) {
    console.error(`${failures} team(s) failed`);
    process.exit(1);
  }
}

const isEntrypoint = process.argv[1] != null && /[\\/]mlb[\\/]moves\.ts$/.test(process.argv[1]);
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
