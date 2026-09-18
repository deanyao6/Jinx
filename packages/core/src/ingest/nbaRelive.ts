/**
 * The NBA half of the on-demand detail queue and Relive (SPEC.md 4.7, 6.19), shared by the
 * `nba-sync` Edge Function and the Node ingest scripts, the way `relive.ts` is for MLB.
 *
 * Relive's line comes from ESPN where ESPN has one (2017-18 on): the game's ESPN event is
 * found by date and nicknames in the month's scoreboard, and its summary carries per-play win
 * probability. For older games the state model in providers/nba/winprob.ts draws the line
 * from the scoring timeline and the frozen pregame probability. The story steps are the same
 * either way.
 */
import { easternDateOf } from '../providers/nba/ids.js';
import { espnKey, parseEspnScoreboard } from '../providers/nba/parse.js';
import {
  buildNbaStorySteps,
  espnPointFinder,
  modelPointFinder,
  modelWinProbability,
  parseEspnWinProbability,
} from '../providers/nba/winprob.js';
import type { WpPoint } from '../providers/mlb/winprob.js';
import type { CanonicalGameDetail, ScoringEvent } from '../types.js';
import type { MinimalDb } from './db.js';
import type { NbaClient } from './nbaClient.js';
import type { DetailContext } from '../providers/nba/parse.js';
import {
  markReliveChecked,
  reliveTargets,
  resolveStepScorers,
  writeRelive,
  type DrainOptions,
  type DrainResult,
  type ReliveTarget,
} from './relive.js';
import { upsertGameDetail, type GameWriteContext } from './writer.js';

/** A `game_scoring_timeline` row as this reads it. */
interface TimelineRow {
  seq: number;
  occurred_at: string | null;
  period: number;
  clock: string | null;
  home_score: number;
  away_score: number;
  scoring_side: 'home' | 'away';
  description: string;
  kind: string | null;
  scorer_player_id: string | null;
  scorer_name: string | null;
}

async function timelineRows(db: MinimalDb, gameId: string): Promise<ScoringEvent[]> {
  const { data, error } = await db
    .from('game_scoring_timeline')
    .select(
      'seq, occurred_at, period, clock, home_score, away_score, scoring_side, description, kind, scorer_player_id, scorer_name',
    )
    .eq('game_id', gameId)
    .order('seq');
  if (error) throw new Error(`game_scoring_timeline: ${error.message}`);
  return ((data ?? []) as TimelineRow[]).map((r) => ({
    seq: r.seq,
    occurredAt: r.occurred_at,
    period: r.period,
    half: null,
    clock: r.clock,
    homeScore: r.home_score,
    awayScore: r.away_score,
    scoringSide: r.scoring_side,
    description: r.description,
    ...(r.kind ? { kind: r.kind as NonNullable<ScoringEvent['kind']> } : {}),
    scorerProviderId: null,
    scorerName: r.scorer_name,
    // The stored row already resolved the scorer to a players row; carry it as-is.
    ...(r.scorer_player_id ? { scorerPlayerId: r.scorer_player_id } : {}),
  }));
}

/** The frozen pregame home win probability, or 0.5 when none was computed. */
async function homePrior(db: MinimalDb, gameId: string): Promise<number> {
  const { data } = await db
    .from('game_win_prob')
    .select('home_win_prob')
    .eq('game_id', gameId)
    .maybeSingle();
  const p = (data as { home_win_prob: number | string } | null)?.home_win_prob;
  const n = Number(p);
  return Number.isFinite(n) && n > 0 && n < 1 ? n : 0.5;
}

/** ESPN's event id for a game, from the month's scoreboard, or null when ESPN has no row. */
export async function espnEventIdFor(
  client: NbaClient,
  game: { scheduled_start: string; home_name: string; away_name: string },
): Promise<string | null> {
  const etDate = easternDateOf(game.scheduled_start);
  const doc = await client.espnScoreboardMonth(etDate.slice(0, 7).replace('-', ''));
  const infos = parseEspnScoreboard(doc.events ?? []);
  const key = espnKey(etDate, game.home_name, game.away_name);
  return infos.find((i) => `${i.etDate}|${i.homeNick}|${i.awayNick}` === key)?.eventId ?? null;
}

export type NbaReliveTarget = ReliveTarget & { scheduled_start?: string };

/**
 * One NBA game's story. Returns the counts, or null when the game has no scoring timeline yet
 * (detail has not landed), in which case nothing is written.
 */
export async function buildNbaRelive(
  db: MinimalDb,
  client: NbaClient,
  game: NbaReliveTarget,
): Promise<{ points: number; steps: number; source: 'espn' | 'model' } | null> {
  const rows = await timelineRows(db, game.game_id);
  if (rows.length === 0) {
    await markReliveChecked(db, game.game_id);
    return null;
  }
  let start = game.scheduled_start;
  if (!start) {
    const { data } = await db
      .from('games')
      .select('scheduled_start')
      .eq('id', game.game_id)
      .single();
    start =
      (data as { scheduled_start: string } | null)?.scheduled_start ?? new Date().toISOString();
  }
  const final = {
    awayScore: game.away_score ?? rows[rows.length - 1]!.awayScore,
    homeScore: game.home_score ?? rows[rows.length - 1]!.homeScore,
    awayName: game.away_name,
    homeName: game.home_name,
  };

  let points: WpPoint[] = [];
  let source: 'espn' | 'model' = 'model';
  let pointFor: (event: ScoringEvent, index: number) => number;
  const eventId = await espnEventIdFor(client, {
    scheduled_start: start,
    home_name: game.home_name,
    away_name: game.away_name,
  }).catch(() => null);
  if (eventId) {
    const summary = await client.espnSummary(eventId).catch(() => null);
    const espnPoints = summary ? parseEspnWinProbability(summary) : [];
    if (espnPoints.length > 10) {
      points = espnPoints.map(({ seq, period, half, homeWp, occurredAt }) => ({
        seq,
        period,
        half,
        homeWp,
        occurredAt,
      }));
      source = 'espn';
      const find = espnPointFinder(espnPoints);
      pointFor = (event) => find(event);
    }
  }
  if (source === 'model') {
    points = modelWinProbability(rows, await homePrior(db, game.game_id));
    pointFor = modelPointFinder(points);
  }
  const steps = buildNbaStorySteps(rows, points, final, pointFor!).map((s) => ({
    ...s,
    scorerPlayerId:
      (rows.find((r) => r.seq === s.seq) as { scorerPlayerId?: string } | undefined)
        ?.scorerPlayerId ?? null,
  }));
  // Steps carry the timeline's resolved scorer where they came from a row; the pregame and
  // final steps name nobody. resolveStepScorers is for provider ids, which the rows lost.
  const resolved = await resolveStepScorers(db, 'nba', steps);
  const withIds = resolved.map((s, i) => ({ ...s, scorerPlayerId: stepScorerId(rows, steps[i]!) }));
  await writeRelive(db, game.game_id, points, withIds);
  return { points: points.length, steps: withIds.length, source };
}

/** The players row of the scoring row a step was built from, by matching score and period. */
function stepScorerId(
  rows: readonly (ScoringEvent & { scorerPlayerId?: string })[],
  step: { homeScore: number; awayScore: number; label: string; scorerName: string | null },
): string | null {
  if (!step.scorerName) return null;
  const row = rows.find(
    (r) =>
      r.homeScore === step.homeScore &&
      r.awayScore === step.awayScore &&
      r.scorerName === step.scorerName,
  );
  return row?.scorerPlayerId ?? null;
}

/** A game's schedule-row context, so a detail rewrite keeps its start, venue and neutral flag. */
export async function detailContextFor(
  db: MinimalDb,
  gameId: string,
  providerGameId: string,
): Promise<DetailContext> {
  const { data } = await db
    .from('games')
    .select('scheduled_start, venue_id, is_neutral_site, venue:venue_id(name)')
    .eq('id', gameId)
    .single();
  const row = data as {
    scheduled_start: string;
    venue_id: string | null;
    is_neutral_site: boolean;
    venue: { name: string } | null;
  } | null;
  return {
    providerGameId,
    scheduledStart: row?.scheduled_start ?? new Date().toISOString(),
    providerVenueId: row?.venue_id ? `venue:${row.venue_id}` : null,
    venueName: row?.venue?.name ?? null,
    isNeutralSite: row?.is_neutral_site ?? false,
  };
}

export interface NbaDetailProvider {
  fetchGameDetail(
    providerGameId: string,
    ctx?: Partial<DetailContext>,
  ): Promise<CanonicalGameDetail>;
}

/**
 * Drains the NBA half of `detail_queue`, then builds stories for attended games that lack one.
 * The same two passes as `drainMlbQueue`, for the same reasons.
 */
export async function drainNbaQueue(
  db: MinimalDb,
  provider: NbaDetailProvider,
  client: NbaClient,
  ctx: GameWriteContext,
  opts: DrainOptions = {},
): Promise<DrainResult> {
  const now = opts.now ?? new Date();
  const result: DrainResult = { detailed: [], relived: [], noStory: [], errors: [] };

  const { data, error } = await db.rpc('detail_queue_pending', {
    p_provider: 'nba',
    p_limit: opts.detailLimit ?? 5,
  });
  if (error) throw new Error(`detail_queue_pending: ${error.message}`);
  const pending = (data ?? []) as { game_id: string; provider_game_id: string; attempts: number }[];

  for (const row of pending) {
    try {
      const detail = await provider.fetchGameDetail(
        row.provider_game_id,
        await detailContextFor(db, row.game_id, row.provider_game_id),
      );
      await upsertGameDetail(db, detail, ctx);
      const { error: doneError } = await db
        .from('detail_queue')
        .update({ done_at: now.toISOString(), last_error: null, attempts: row.attempts + 1 })
        .eq('game_id', row.game_id);
      if (doneError) throw new Error(doneError.message);
      result.detailed.push(row.provider_game_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${row.provider_game_id}: ${message}`);
      await db
        .from('detail_queue')
        .update({ attempts: row.attempts + 1, last_error: message.slice(0, 500) })
        .eq('game_id', row.game_id);
    }
  }

  const { error: settleError } = await db.rpc('detail_queue_settle');
  if (settleError) result.errors.push(`detail_queue_settle: ${settleError.message}`);

  for (const game of await reliveTargets(db, 'nba', opts.reliveLimit ?? 5)) {
    try {
      const built = await buildNbaRelive(db, client, game);
      if (built) result.relived.push(game.provider_game_id);
      else result.noStory.push(game.provider_game_id);
    } catch (err) {
      result.errors.push(
        `${game.provider_game_id} relive: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return result;
}
