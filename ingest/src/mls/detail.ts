/**
 * MLS detail and Relive from ESPN's summary (next-wave E.4).
 *
 *   npx tsx ingest/src/mls/detail.ts --events 655997,761829   # specific matches
 *   npx tsx ingest/src/mls/detail.ts --queue [--limit 100]      # drain detail_queue for MLS (daily)
 *   npx tsx ingest/src/mls/detail.ts --attended [--rebuild]     # every attended final without detail
 *
 * One summary request per match (SPEC 4.7: detail only for matches someone logged). It writes
 * appearances with their box-score lines, the goals as the scoring timeline, the moments, the
 * pledge lock (first goal or halftime) and the exact end time, then the Relive story on the
 * state-model line (packages/core/src/providers/mls/detail.ts says why there is no ESPN line).
 */
import {
  buildMlsStory,
  parseMlsEvent,
  parseMlsSummaryDetail,
  resolveStepScorers,
  selectAll,
  upsertGameDetail,
  writeRelive,
  type CanonicalGame,
  type GameWriteContext,
  type MlsEvent,
  type MlsSummaryDetail,
} from '@jinx/core';

import { createDb, loadTeamMap, loadVenueMaps, type Db } from '../db.js';
import { mlsProvider } from './provider.js';

interface GameRow {
  id: string;
  provider_game_id: string;
  season: number;
  scheduled_start: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_shootout_score: number | null;
  away_shootout_score: number | null;
  detail_ingested_at: string | null;
  home: { name: string; provider_team_id: string } | null;
  away: { name: string; provider_team_id: string } | null;
  prob: { home_win_prob: number; draw_prob: number | null } | null;
}

const COLUMNS =
  'id, provider_game_id, season, scheduled_start, status, home_score, away_score, home_shootout_score, away_shootout_score, detail_ingested_at, home:home_team_id(name, provider_team_id), away:away_team_id(name, provider_team_id), prob:game_win_prob(home_win_prob, draw_prob)';

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : null;
}

async function targets(db: Db): Promise<GameRow[]> {
  const events = arg('events')?.split(',').map((s) => s.trim()).filter(Boolean);
  if (events?.length) {
    return selectAll<GameRow>(db, 'games', COLUMNS, (q) =>
      q.eq('provider', 'espn_mls').in('provider_game_id', events),
    );
  }
  if (process.argv.includes('--queue')) {
    const { data, error } = await db.rpc('detail_queue_pending', {
      p_provider: 'espn_mls',
      p_limit: Number(arg('limit') ?? 100),
    });
    if (error) throw new Error(`detail_queue_pending: ${error.message}`);
    const ids = ((data ?? []) as { game_id: string }[]).map((r) => r.game_id);
    if (ids.length === 0) return [];
    return selectAll<GameRow>(db, 'games', COLUMNS, (q) => q.in('id', ids));
  }
  // Attended finals: through the attendances relation so PostgREST filters server-side.
  const { data, error } = await db
    .from('attendances')
    .select(`game_id, games!inner(${COLUMNS.replace('id, ', 'id, ')})`)
    .eq('games.provider', 'espn_mls')
    .eq('games.status', 'final')
    .limit(1000);
  if (error) throw new Error(`attendances: ${error.message}`);
  const byId = new Map<string, GameRow>();
  for (const row of (data ?? []) as { games: GameRow }[]) byId.set(row.games.id, row.games);
  const rebuild = process.argv.includes('--rebuild');
  return [...byId.values()].filter((g) => rebuild || g.detail_ingested_at == null);
}

/** The schedule half of the detail, from the match's own scoreboard event (kept by the provider's cache). */
async function scheduleRow(provider: ReturnType<typeof mlsProvider>, g: GameRow): Promise<CanonicalGame> {
  const start = new Date(g.scheduled_start);
  const month = await provider.month(start.getUTCFullYear(), start.getUTCMonth() + 1);
  let event = (month.events ?? []).find((e: MlsEvent) => e.id === g.provider_game_id);
  if (!event) {
    // A match near a month boundary is listed under its local date's month.
    const prev = new Date(start.getTime() - 3 * 86_400_000);
    const m2 = await provider.month(prev.getUTCFullYear(), prev.getUTCMonth() + 1);
    event = (m2.events ?? []).find((e: MlsEvent) => e.id === g.provider_game_id);
  }
  if (!event) throw new Error(`no scoreboard event for ${g.provider_game_id}`);
  return parseMlsEvent(event);
}

async function main(): Promise<void> {
  const db = createDb();
  const provider = mlsProvider();
  const ctx: GameWriteContext = {
    teamMap: await loadTeamMap(db, 'espn_mls'),
    venueMaps: await loadVenueMaps(db),
    venueLookup: 'mls',
  };
  const games = await targets(db);
  if (games.length === 0) {
    console.log('nothing to do');
    return;
  }
  let done = 0;
  for (const g of games) {
    try {
      const summary = (await provider.summary(g.provider_game_id, true)) as MlsSummaryDetail;
      const schedule = await scheduleRow(provider, g);
      const detail = parseMlsSummaryDetail(summary, schedule);
      const r = await upsertGameDetail(db, detail, ctx);
      if (schedule.status === 'final') {
        const pregame =
          g.prob?.home_win_prob != null
            ? {
                home: Number(g.prob.home_win_prob),
                draw: Number(g.prob.draw_prob ?? 0),
                away: 1 - Number(g.prob.home_win_prob) - Number(g.prob.draw_prob ?? 0),
              }
            : null;
        const shootout =
          g.home_shootout_score != null && g.away_shootout_score != null
            ? { home: g.home_shootout_score, away: g.away_shootout_score }
            : null;
        const { points, steps } = buildMlsStory(
          detail,
          { homeName: g.home?.name ?? 'Home', awayName: g.away?.name ?? 'Away' },
          pregame,
          shootout,
        );
        const rows = await resolveStepScorers(db, 'espn_mls', steps);
        await writeRelive(db, r.gameId, points, rows);
        console.log(
          `${g.provider_game_id}: ${detail.awayScore}-${detail.homeScore}; ${r.appearances} appearances, ${r.timeline} goals, ${r.events} moments; ${points.length} points, ${steps.length} steps`,
        );
      } else {
        console.log(`${g.provider_game_id}: not final, detail only (${r.appearances} appearances)`);
      }
      done += 1;
    } catch (err) {
      console.error(`${g.provider_game_id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (process.argv.includes('--queue')) {
    const { data } = await db.rpc('detail_queue_settle', {});
    console.log(`queue settled: ${String(data ?? 0)} row(s)`);
  }
  console.log(`done: ${done} of ${games.length}`);
}

const isEntrypoint = process.argv[1] != null && /[\\/]detail\.ts$/.test(process.argv[1]);
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
