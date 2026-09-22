/**
 * MLS current rosters into `team_rosters`, for the favourite-player picker (next-wave E.3).
 *
 *   npx tsx ingest/src/mls/rosters.ts [--teams 20232,22529]
 *
 * One request per club to ESPN's `teams/{id}/roster` (docs/verification.md), through the same
 * throttled, cached provider as the schedules; players new to the provider (`espn_mls`, the
 * athlete id) are inserted into `players`. Daily in `mls-ingest.yml`.
 */
import { selectAll, upsertTeamRoster } from '@jinx/core';

import { createDb } from '../db.js';
import { mlsProvider } from './provider.js';

interface TeamRow {
  id: string;
  provider_team_id: string;
  abbreviation: string;
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : null;
}

/** The MLS season is the calendar year until the 2027 change (`season_key` carries it then). */
export function currentMlsSeason(now = new Date()): number {
  return now.getUTCFullYear();
}

async function main(): Promise<void> {
  const db = createDb();
  const provider = mlsProvider();
  const season = currentMlsSeason();
  const only = new Set(
    arg('teams')
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [],
  );
  const teams = (
    await selectAll<TeamRow>(db, 'teams', 'id, provider_team_id, abbreviation', (q) =>
      q.eq('provider', 'espn_mls').eq('active', true),
    )
  ).filter((t) => only.size === 0 || only.has(t.provider_team_id));
  if (teams.length === 0) throw new Error('no active MLS clubs in the database');

  let failures = 0;
  let total = 0;
  for (const team of teams.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation))) {
    try {
      const entries = await provider.fetchRoster(team.provider_team_id);
      if (entries.length === 0) throw new Error('empty roster');
      const r = await upsertTeamRoster(db, {
        provider: 'espn_mls',
        sport: 'mls',
        teamId: team.id,
        season,
        entries,
      });
      total += r.written;
      console.log(
        `${team.abbreviation}: ${r.written} on roster (${r.newPlayers} new players, ${r.removed} removed)`,
      );
    } catch (err) {
      failures += 1;
      console.error(`${team.abbreviation}: ${String(err)}`);
    }
  }
  console.log(`${season}: ${total} roster rows across ${teams.length - failures} clubs`);
  if (failures > 0) {
    console.error(`${failures} club(s) failed`);
    process.exit(1);
  }
}

const isEntrypoint = process.argv[1] != null && /[\\/]rosters\.ts$/.test(process.argv[1]);
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
