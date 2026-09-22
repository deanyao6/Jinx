/**
 * NFL joins into player_moves, from the nflverse weekly rosters, for "first days as an Eagle".
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/nfl/moves.ts [--from 2016 --to 2026]
 *
 * A join is the first week a player is on a team's roster (ACT, INA, RES, DEV, EXE) that is
 * not the team he was on the week before, across seasons, so an offseason signing is a week-1
 * join (`rosterJoins`). A rookie's first week is a join too. The previous season is always read
 * so the first week of `--from` can be compared with something. The join DATE is the start of
 * that roster week: the league's first game of the week, less six days. Defaults to the current
 * season. Idempotent.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rosterJoins, upsertRows, type RosterWeekRow } from '@jinx/core';

import { createDb } from '../db.js';
import { arg, ensurePlayers, loadNflPlayers, refreshAllStats } from '../famous/players.js';
import { fetchAsset, openAsset, schedulesAsset, weeklyRostersAsset } from './assets.js';
import { readCsv } from './csv.js';
import { NFL_ROSTER_STATUSES, toWeeklyRosterRow } from './rosters.js';
import { currentNflSeason } from './run.js';
import { loadScheduleRows } from './schedule.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

interface SeedTeam {
  abbr: string;
  franchise: string;
  first: number;
  last: number | null;
}

/**
 * The team a roster code meant in a season. Roster files write the CURRENT abbreviation (LV,
 * LA, LAC) for every season, but a 2019 Raiders game belongs to the OAK team row, so the
 * franchise's row that was active that season is the one a join must point at.
 */
export function teamForSeason(
  seed: readonly SeedTeam[],
  code: string,
  season: number,
): string | null {
  const franchise = seed.find((t) => t.abbr === code)?.franchise;
  if (!franchise) return null;
  const row = seed.find(
    (t) => t.franchise === franchise && t.first <= season && (t.last == null || t.last >= season),
  );
  return row?.abbr ?? null;
}

/** First game date of each (season, week), less six days: when that roster week began. */
export function weekStarts(
  schedule: readonly { season: number; week: number | null; gameday: string }[],
): Map<string, string> {
  const first = new Map<string, string>();
  for (const g of schedule) {
    if (g.week == null || !g.gameday) continue;
    const key = `${g.season}:${g.week}`;
    const cur = first.get(key);
    if (!cur || g.gameday < cur) first.set(key, g.gameday);
  }
  const out = new Map<string, string>();
  for (const [k, day] of first) {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 6);
    out.set(k, d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * The weekly roster file for a season. From 2024 the release carries `.csv.gz`; before that
 * only `.csv` (checked 2026-09-17), so a 404 on the first is followed by the second.
 */
async function fetchWeeklyRoster(
  season: number,
  log: (s: string) => void,
): Promise<{ path: string } | null> {
  for (const ref of [
    weeklyRostersAsset(season),
    { tag: 'weekly_rosters', file: `roster_weekly_${season}.csv` },
  ]) {
    try {
      return await fetchAsset(ref, { log });
    } catch (err) {
      if (!String(err).includes('HTTP 404')) throw err;
    }
  }
  return null;
}

async function main(): Promise<void> {
  const to = Number(arg('to') ?? currentNflSeason());
  const from = Number(arg('from') ?? to);
  const db = createDb();
  const log = (s: string) => console.log(s);

  const seed = JSON.parse(
    readFileSync(path.join(ROOT, 'seed', 'nfl_teams.json'), 'utf8'),
  ) as SeedTeam[];
  const { data: teamRows, error } = await db
    .from('teams')
    .select('id, abbreviation')
    .eq('sport_id', 'nfl');
  if (error) throw new Error(error.message);
  const teamIdByAbbr = new Map(
    ((teamRows ?? []) as { id: string; abbreviation: string }[]).map((t) => [t.abbreviation, t.id]),
  );

  const { path: gamesPath } = await fetchAsset(schedulesAsset(), { log });
  const starts = weekStarts(await loadScheduleRows(openAsset(gamesPath)));
  const players = await loadNflPlayers(log);

  const rows: RosterWeekRow[] = [];
  const names = new Map<string, string>();
  for (let season = Math.max(2002, from - 1); season <= to; season += 1) {
    const fetched = await fetchWeeklyRoster(season, log);
    if (!fetched) {
      log(`roster_weekly_${season}: not published (404), skipped`);
      continue;
    }
    let n = 0;
    for await (const raw of readCsv(openAsset(fetched.path))) {
      const r = toWeeklyRosterRow(raw);
      if (!r.gsis_id || !r.team || r.season == null || r.week == null) continue;
      if (!r.status || !NFL_ROSTER_STATUSES.has(r.status)) continue;
      rows.push({
        season: r.season,
        week: r.week,
        team: r.team,
        gsisId: r.gsis_id,
        rookieSeason: players.get(r.gsis_id)?.rookieSeason ?? null,
      });
      if (r.full_name) names.set(r.gsis_id, r.full_name);
      n += 1;
    }
    log(`${season}: ${n} roster rows`);
  }

  const joins = rosterJoins(rows).filter((j) => j.season >= from);
  const wanted: { gsisId: string; teamId: string; joinedOn: string }[] = [];
  let unplaced = 0;
  for (const j of joins) {
    const abbr = teamForSeason(seed, j.team, j.season);
    const teamId = abbr ? teamIdByAbbr.get(abbr) : undefined;
    const joinedOn = starts.get(`${j.season}:${j.week}`);
    if (!teamId || !joinedOn) {
      unplaced += 1;
      continue;
    }
    wanted.push({ gsisId: j.gsisId, teamId, joinedOn });
  }
  const ids = await ensurePlayers(
    db,
    'nfl',
    'nflverse',
    wanted.map((w) => ({
      providerPlayerId: w.gsisId,
      fullName: players.get(w.gsisId)?.name ?? names.get(w.gsisId) ?? w.gsisId,
    })),
  );
  const out = new Map<string, Record<string, unknown>>();
  for (const w of wanted) {
    const playerId = ids.get(w.gsisId)!;
    out.set(`${playerId}:${w.teamId}:${w.joinedOn}`, {
      player_id: playerId,
      team_id: w.teamId,
      joined_on: w.joinedOn,
      kind: 'roster',
      source: 'nflverse-weekly-rosters',
    });
  }
  await upsertRows(db, 'player_moves', [...out.values()], 'player_id,team_id,joined_on');
  console.log(
    `${out.size} NFL moves for ${from}-${to}${unplaced ? ` (${unplaced} without a team or week date, skipped)` : ''}`,
  );
  await refreshAllStats(db);
}

const isEntrypoint = process.argv[1] != null && /[\\/]nfl[\\/]moves\.ts$/.test(process.argv[1]);
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
