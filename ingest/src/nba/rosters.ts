/**
 * Current NBA rosters for the favourite-player picker (migration 20260917000900).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/nba/rosters.ts [--teams 1610612747]
 *
 * For every active NBA team: `commonteamroster` for the season in progress (one request per
 * team, one a second), upsert for that season and delete anyone no longer listed. Runs daily
 * from .github/workflows/daily-jobs.yml.
 */
import { seasonForDate, selectAll, upsertTeamRoster } from '@jinx/core';

import { createDb } from '../db.js';
import { nbaProvider } from './provider.js';

interface TeamRow {
  id: string;
  provider_team_id: string;
  abbreviation: string;
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : null;
}

async function main(): Promise<void> {
  const db = createDb();
  const provider = nbaProvider();
  const season = seasonForDate(new Date().toISOString().slice(0, 10));
  const only = new Set(
    arg('teams')
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [],
  );
  const teams = (
    await selectAll<TeamRow>(db, 'teams', 'id, provider_team_id, abbreviation', (q) =>
      q.eq('provider', 'nba').eq('active', true),
    )
  ).filter((t) => only.size === 0 || only.has(t.provider_team_id));
  if (teams.length === 0) throw new Error('no active NBA teams in the database');

  let failures = 0;
  let total = 0;
  for (const team of teams.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation))) {
    try {
      const entries = await provider.fetchRoster(team.provider_team_id);
      if (entries.length === 0) throw new Error('empty roster');
      const r = await upsertTeamRoster(db, {
        provider: 'nba',
        sport: 'nba',
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
