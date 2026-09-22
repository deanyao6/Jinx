/**
 * NFL ingestion CLI: nflverse schedule + per-season play-by-play, appearances and moments.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx ingest/src/nfl/run.ts --seasons 2023,2024
 *     npx tsx ingest/src/nfl/run.ts --from 2000 --to 2026 [--skip-schedule] [--skip-detail] [--force]
 *     npx tsx ingest/src/nfl/run.ts --queued     # the current season, plus seasons of queued games
 *
 * Schedule: games.csv is upserted for every season from 2000 regardless of --seasons (cheap, and it
 * keeps scores and kickoff times current). Detail, on demand (SPEC 4.7, since 2026-09-22): for
 * each requested season, the games `games_wanting_detail` names (queued because a fan logged,
 * checked in, is going or matched a ticket; attended; famous) and nothing else. A season with
 * none wanted is skipped without downloading its play-by-play. For the wanted games the pbp
 * csv.gz is grouped by game_id, parsed with parseNflGame, joined with appearances, and written
 * with upsertGameDetail(detectNflMoments); the queue is settled afterwards. Progress in
 * ingest_progress (job nfl_detail, key season) records each pass; `--force` details every
 * final of the season the old way (a full rebuild, not for the nightly job).
 */
import {
  detectNflMoments,
  parseNflGame,
  type NflverseGameRow,
  type NflversePbpRow,
} from '@jinx/core';

import { createDb, getProgress, loadTeamMap, loadVenueMaps, setProgress, type Db } from '../db.js';
import { upsertGameDetail, type GameWriteContext } from '../games.js';
import {
  appearancesFromSnapCounts,
  appearancesFromWeeklyStats,
  buildPfrToGsis,
  buildScheduleIndex,
  countAppearances,
  type AppearanceIndex,
  type PlayerIdentity,
  type ScheduleIndex,
} from './appearances.js';
import {
  fetchAsset,
  openAsset,
  pbpAsset,
  playersAsset,
  schedulesAsset,
  snapCountsAsset,
  SNAP_COUNTS_FROM,
  statsPlayerWeekAsset,
  type AssetRef,
} from './assets.js';
import { readCsv, toPbpRow, toPlayerIdRow, toSnapCountRow, toStatsWeekRow } from './csv.js';
import { approxFinalAt, groupBySeason, loadScheduleRows, upsertAllSeasons } from './schedule.js';

export const DETAIL_JOB = 'nfl_detail';
const SCHEDULE_FROM = 2000;

interface Args {
  seasons: number[];
  skipSchedule: boolean;
  skipDetail: boolean;
  force: boolean;
  /** Also ingest the seasons of queued NFL games that lack detail. */
  queued: boolean;
}

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function currentNflSeason(now = new Date()): number {
  return now.getUTCMonth() + 1 >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

export function parseArgs(argv: string[]): Args {
  const list = argValue(argv, 'seasons');
  let seasons: number[];
  if (list) {
    seasons = list
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n));
  } else {
    const from = Number(argValue(argv, 'from') ?? currentNflSeason());
    const to = Number(argValue(argv, 'to') ?? from);
    seasons = [];
    for (let s = from; s <= to; s++) seasons.push(s);
  }
  return {
    seasons,
    skipSchedule: argv.includes('--skip-schedule'),
    skipDetail: argv.includes('--skip-detail'),
    force: argv.includes('--force'),
    queued: argv.includes('--queued'),
  };
}

/** "2019_07_PHI_DAL" -> 2019. nflverse game ids always lead with the season. */
export function seasonOfGameId(providerGameId: string): number | null {
  const season = Number(providerGameId.slice(0, 4));
  return Number.isInteger(season) && season >= 1999 ? season : null;
}

export interface WantedGame {
  game_id: string;
  provider_game_id: string;
  season: number;
  reason: 'queue' | 'attended' | 'famous';
}

/** The NFL games that want detail right now (SPEC 4.7): queued, or attended or famous without it. */
export async function wantedGames(db: Db): Promise<WantedGame[]> {
  const { data, error } = await db.rpc('games_wanting_detail', { p_provider: 'nflverse' });
  if (error) throw new Error(`games_wanting_detail: ${error.message}`);
  return (data ?? []) as WantedGame[];
}

/**
 * Seasons that hold a wanted NFL game. A user who logs a game from a season nobody has ingested
 * gets it overnight, instead of only ever the current season.
 */
export async function queuedSeasons(db: Db): Promise<number[]> {
  const seasons = new Set<number>();
  for (const row of await wantedGames(db)) {
    const season = row.season ?? seasonOfGameId(row.provider_game_id);
    if (season !== null) seasons.add(season);
  }
  return [...seasons].sort((a, b) => a - b);
}

const log = (line: string): void => console.log(line);

async function fetchCsvRows<T>(
  ref: AssetRef,
  map: (r: Record<string, string | null>) => T,
  force: boolean,
): Promise<T[]> {
  const { path, source } = await fetchAsset(ref, { force, log });
  log(`  ${ref.file}: ${source}`);
  const out: T[] = [];
  for await (const r of readCsv(openAsset(path))) out.push(map(r));
  return out;
}

/** Every team abbreviation and stadium id in games.csv (season >= from) must resolve. */
export function verifyReferenceData(
  rows: NflverseGameRow[],
  ctx: GameWriteContext,
  from: number,
): { unknownTeams: string[]; unknownStadiums: string[] } {
  const unknownTeams = new Set<string>();
  const unknownStadiums = new Set<string>();
  for (const r of rows) {
    if (r.season < from) continue;
    for (const t of [r.home_team, r.away_team]) if (!ctx.teamMap.has(t)) unknownTeams.add(t);
    if (r.stadium_id != null && !ctx.venueMaps.byNflverseStadiumId.has(r.stadium_id)) {
      unknownStadiums.add(r.stadium_id);
    }
  }
  return { unknownTeams: [...unknownTeams].sort(), unknownStadiums: [...unknownStadiums].sort() };
}

async function loadPbpBySeason(
  season: number,
  force: boolean,
): Promise<Map<string, NflversePbpRow[]>> {
  const byGame = new Map<string, NflversePbpRow[]>();
  let fetched;
  try {
    fetched = await fetchAsset(pbpAsset(season), { force, log });
  } catch (err) {
    if (String(err).includes('HTTP 404')) {
      log(`  play_by_play_${season}.csv.gz: not published yet (404); continuing without plays`);
      return byGame;
    }
    throw err;
  }
  log(`  play_by_play_${season}.csv.gz: ${fetched.source}`);
  for await (const raw of readCsv(openAsset(fetched.path))) {
    const row = toPbpRow(raw);
    const list = byGame.get(row.game_id);
    if (list) list.push(row);
    else byGame.set(row.game_id, [row]);
  }
  return byGame;
}

async function loadAppearances(
  season: number,
  schedule: ScheduleIndex,
  players: () => Promise<Map<string, PlayerIdentity>>,
  force: boolean,
): Promise<AppearanceIndex> {
  if (season >= SNAP_COUNTS_FROM) {
    const rows = await fetchCsvRows(snapCountsAsset(season), toSnapCountRow, force);
    const index = appearancesFromSnapCounts(rows, await players(), schedule);
    if (countAppearances(index) > 0) return index;
    log(`  snap_counts_${season}: no usable rows, falling back to stats_player_week`);
  }
  const rows = await fetchCsvRows(statsPlayerWeekAsset(season), toStatsWeekRow, force);
  return appearancesFromWeeklyStats(rows, schedule);
}

async function runSeasonDetail(
  db: Db,
  ctx: GameWriteContext,
  season: number,
  seasonRows: NflverseGameRow[],
  schedule: ScheduleIndex,
  players: () => Promise<Map<string, PlayerIdentity>>,
  force: boolean,
  wanted: Set<string> | null,
): Promise<void> {
  const key = String(season);
  await setProgress(db, DETAIL_JOB, key, 'running');
  try {
    const pbp = await loadPbpBySeason(season, force);
    const appearances = await loadAppearances(season, schedule, players, force);
    const scheduled = new Set(seasonRows.map((r) => r.game_id));
    const pbpWithoutSchedule = [...pbp.keys()].filter((id) => !scheduled.has(id));
    const finals = seasonRows.filter(
      (r) => r.home_score != null && r.away_score != null && (wanted === null || wanted.has(r.game_id)),
    );

    const totals = { games: 0, appearances: 0, timeline: 0, moments: 0, reliable: 0, noPbp: 0 };
    for (const row of finals) {
      const plays = pbp.get(row.game_id) ?? [];
      if (plays.length === 0) totals.noPbp++;
      const detail = parseNflGame(row, plays);
      detail.appearances = appearances.byGame.get(row.game_id) ?? [];
      const items = detail.plays.sport === 'nfl' ? detail.plays.items : [];
      const lastStamped = [...items].reverse().find((p) => p.timeOfDay != null);
      detail.finalAt = lastStamped?.timeOfDay ?? approxFinalAt(detail.scheduledStart);
      const res = await upsertGameDetail(db, detail, ctx, detectNflMoments);
      totals.games++;
      totals.appearances += res.appearances;
      totals.timeline += res.timeline;
      totals.moments += res.events;
      if (detail.timestampsReliable) totals.reliable++;
    }

    // With detail on demand a season is never "complete": a fan can log another of its games
    // tomorrow. Only a --force rebuild of every final can say so.
    const complete = wanted === null && finals.length === seasonRows.length && seasonRows.length > 0;
    const detail = {
      ...totals,
      scheduled: seasonRows.length,
      wanted: wanted === null ? null : finals.length,
      complete,
      appearance_rows: countAppearances(appearances),
      appearance_skipped: appearances.skipped,
      pbp_without_schedule: pbpWithoutSchedule.length,
    };
    await setProgress(db, DETAIL_JOB, key, complete ? 'done' : 'pending', detail);
    const skipped = Object.entries(appearances.skipped)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k} ${n}`)
      .join(', ');
    log(
      `season ${season}: ${totals.games}/${seasonRows.length} games, ${totals.appearances} appearances, ` +
        `${totals.timeline} timeline rows, ${totals.moments} moments; reliable ${totals.reliable}, ` +
        `no pbp ${totals.noPbp}, pbp without schedule ${pbpWithoutSchedule.length}` +
        (skipped ? `; appearance rows skipped: ${skipped}` : '') +
        (complete ? '' : wanted === null ? ' [incomplete season, left pending]' : ' [on demand]'),
    );
  } catch (err) {
    await setProgress(db, DETAIL_JOB, key, 'failed', { error: String(err) });
    throw err;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.seasons.length === 0) throw new Error('no seasons requested');
  const db = createDb();
  if (args.queued) {
    const extra = (await queuedSeasons(db)).filter((s) => !args.seasons.includes(s));
    if (extra.length > 0) log(`queued games add season(s): ${extra.join(', ')}`);
    args.seasons.push(...extra);
  }
  const ctx: GameWriteContext = {
    teamMap: await loadTeamMap(db, 'nflverse'),
    venueMaps: await loadVenueMaps(db),
    venueLookup: 'nflverse',
  };

  log('schedule:');
  const { path: gamesPath, source } = await fetchAsset(schedulesAsset(), {
    force: args.force,
    log,
  });
  log(`  games.csv: ${source}`);
  const rows = await loadScheduleRows(openAsset(gamesPath));
  const verify = verifyReferenceData(rows, ctx, SCHEDULE_FROM);
  log(
    `  unknown team abbreviations: ${verify.unknownTeams.length}, unknown stadium ids: ${verify.unknownStadiums.length}`,
  );
  if (verify.unknownTeams.length > 0 || verify.unknownStadiums.length > 0) {
    throw new Error(
      `reference data missing: teams [${verify.unknownTeams.join(', ')}] stadiums [${verify.unknownStadiums.join(', ')}]`,
    );
  }

  if (!args.skipSchedule) {
    const summary = await upsertAllSeasons(db, ctx, rows, { from: SCHEDULE_FROM });
    const games = summary.reduce((n, s) => n + s.games, 0);
    const finals = summary.reduce((n, s) => n + s.finals, 0);
    log(`  upserted ${games} games (${finals} final) across ${summary.length} seasons`);
  }
  if (args.skipDetail) return;

  const bySeason = groupBySeason(rows);
  const schedule = buildScheduleIndex(rows);
  let playersPromise: Promise<Map<string, PlayerIdentity>> | undefined;
  const players = (): Promise<Map<string, PlayerIdentity>> => {
    playersPromise ??= fetchCsvRows(playersAsset(), toPlayerIdRow, args.force).then(buildPfrToGsis);
    return playersPromise;
  };

  log('detail:');
  // Detail on demand: only the games that want it, unless --force rebuilds whole seasons.
  const wantedBySeason = new Map<number, Set<string>>();
  if (!args.force) {
    for (const w of await wantedGames(db)) {
      const season = w.season ?? seasonOfGameId(w.provider_game_id);
      if (season === null) continue;
      let set = wantedBySeason.get(season);
      if (!set) wantedBySeason.set(season, (set = new Set()));
      set.add(w.provider_game_id);
    }
    const total = [...wantedBySeason.values()].reduce((n, s) => n + s.size, 0);
    log(`  ${total} game(s) want detail across ${wantedBySeason.size} season(s)`);
  }
  for (const season of args.seasons) {
    const key = String(season);
    if (args.force && (await getProgress(db, DETAIL_JOB, key)) === 'done') {
      log(`season ${season}: already done, skipping`);
      continue;
    }
    const wanted = args.force ? null : (wantedBySeason.get(season) ?? new Set<string>());
    if (wanted !== null && wanted.size === 0) {
      log(`season ${season}: nothing wants detail, skipping`);
      continue;
    }
    const seasonRows = bySeason.get(season);
    if (!seasonRows || seasonRows.length === 0) {
      log(`season ${season}: not in games.csv, skipping`);
      continue;
    }
    await runSeasonDetail(db, ctx, season, seasonRows, schedule, players, args.force, wanted);
  }
  if (!args.force) {
    const { data, error } = await db.rpc('detail_queue_settle', {});
    if (error) throw new Error(`detail_queue_settle: ${error.message}`);
    log(`  queue settled: ${String(data ?? 0)} row(s)`);
  }
}

const isEntrypoint = process.argv[1] != null && /[\\/]run\.ts$/.test(process.argv[1]);
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
