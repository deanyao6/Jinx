/**
 * Current MLB rosters for the favourite-player picker (migration 20260917000900).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/mlb/rosters.ts [--teams 143,121]
 *
 * For every active MLB team: fetch the 40-man roster from the Stats API (one request per team,
 * rate-limited by MlbClient), keep active and injured players, upsert them for the current
 * season and delete anyone no longer listed. Runs daily from .github/workflows/daily-jobs.yml.
 * A failure on one team is logged and the run continues; the exit code is non-zero at the end
 * so the workflow shows it.
 */
import { selectAll, upsertTeamRoster } from '@jinx/core';

import { createDb } from '../db.js';
import { MlbProvider } from './provider.js';

interface TeamRow {
  id: string;
  provider_team_id: string;
  abbreviation: string;
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : null;
}

/** The roster endpoint has no season: it is today's roster, so the season is this year. */
export function currentMlbSeason(now = new Date()): number {
  return now.getUTCFullYear();
}

async function main(): Promise<void> {
  const db = createDb();
  const provider = new MlbProvider();
  const season = currentMlbSeason();

  const only = new Set(
    arg('teams')
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [],
  );
  const teams = (
    await selectAll<TeamRow>(db, 'teams', 'id, provider_team_id, abbreviation', (q) =>
      q.eq('provider', 'mlb').eq('active', true),
    )
  ).filter((t) => only.size === 0 || only.has(t.provider_team_id));
  if (teams.length === 0) throw new Error('no active MLB teams in the database');

  let failures = 0;
  let total = 0;
  for (const team of teams.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation))) {
    try {
      const entries = await provider.fetchRoster(team.provider_team_id);
      if (entries.length === 0) throw new Error('empty roster');
      const r = await upsertTeamRoster(db, {
        provider: 'mlb',
        sport: 'mlb',
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
  console.log(`${season}: ${total} roster rows across ${teams.length - failures} teams`);
  if (failures > 0) {
    console.error(`${failures} team(s) failed`);
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
