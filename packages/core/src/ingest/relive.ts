/**
 * The on-demand detail queue and Relive, without a human (SPEC.md 4.7, 6.19).
 *
 * Lives in core so the same code runs in the `mlb-sync` Edge Function (every 15 minutes) and in
 * the Node ingest scripts. Before this, nothing drained `detail_queue` and nothing scheduled
 * built a story for any sport, so a newly logged game never got one.
 */
import { buildStorySteps, parseWinProbability } from '../providers/mlb/winprob.js';
import type { RawEntry, StoryStep, WpPoint } from '../providers/mlb/winprob.js';
import type { CanonicalGameDetail } from '../types.js';
import type { MinimalDb } from './db.js';
import type { MlbClient } from './mlbClient.js';
import { lookupPlayers, upsertGameDetail, type GameWriteContext } from './writer.js';

/** A row of `games_needing_relive`. */
export interface ReliveTarget {
  game_id: string;
  provider_game_id: string;
  season: number;
  home_score: number | null;
  away_score: number | null;
  home_name: string;
  away_name: string;
}

/** A story step as stored: the scorer resolved to a `players` row where there is one. */
export type ReliveStepRow = StoryStep & {
  scorerPlayerId?: string | null;
  scorerName?: string | null;
};

/**
 * Resolves each step's provider player id to our `players` row, and takes that row's full
 * name over the provider's short form. A scorer we have no row for keeps the name alone.
 */
export async function resolveStepScorers(
  db: MinimalDb,
  provider: string,
  steps: readonly (StoryStep & { scorerProviderId?: string | null })[],
): Promise<ReliveStepRow[]> {
  const ids = steps.map((s) => s.scorerProviderId).filter((id): id is string => !!id);
  const players = ids.length > 0 ? await lookupPlayers(db, provider, ids) : new Map();
  return steps.map((s) => {
    const known = s.scorerProviderId ? players.get(s.scorerProviderId) : undefined;
    return {
      ...s,
      scorerPlayerId: known?.id ?? null,
      scorerName: known?.fullName ?? s.scorerName ?? null,
    };
  });
}

/** Games someone attended that are final, have detail, and have no story yet. */
export async function reliveTargets(
  db: MinimalDb,
  provider: 'mlb' | 'nflverse' | 'nba',
  limit: number,
): Promise<ReliveTarget[]> {
  const { data, error } = await db.rpc('games_needing_relive', {
    p_provider: provider,
    p_limit: limit,
  });
  if (error) throw new Error(`games_needing_relive: ${error.message}`);
  return (data ?? []) as ReliveTarget[];
}

/** Records that the worker looked, so a game with no published win probability is not refetched forever. */
export async function markReliveChecked(db: MinimalDb, gameId: string, now = new Date()) {
  const { error } = await db
    .from('games')
    .update({ relive_checked_at: now.toISOString() })
    .eq('id', gameId);
  if (error) throw new Error(`relive_checked_at: ${error.message}`);
}

/** Replaces a game's win probability line and story. Steps go first: they reference the points. */
export async function writeRelive(
  db: MinimalDb,
  gameId: string,
  points: readonly WpPoint[],
  steps: readonly ReliveStepRow[],
): Promise<void> {
  const { error: delSteps } = await db.from('game_story_steps').delete().eq('game_id', gameId);
  if (delSteps) throw new Error(`game_story_steps: ${delSteps.message}`);
  const { error: delWp } = await db.from('game_wp_timeline').delete().eq('game_id', gameId);
  if (delWp) throw new Error(`game_wp_timeline: ${delWp.message}`);
  const { error: wpError } = await db.from('game_wp_timeline').insert(
    points.map((p) => ({
      game_id: gameId,
      seq: p.seq,
      period: p.period,
      half: p.half,
      home_wp: p.homeWp,
      occurred_at: p.occurredAt,
    })),
  );
  if (wpError) throw new Error(`game_wp_timeline: ${wpError.message}`);
  const { error: stepError } = await db.from('game_story_steps').insert(
    steps.map((s) => ({
      game_id: gameId,
      seq: s.seq,
      wp_seq: s.wpSeq,
      away_score: s.awayScore,
      home_score: s.homeScore,
      label: s.label,
      text: s.text,
      kind: s.kind ?? null,
      scorer_player_id: s.scorerPlayerId ?? null,
      scorer_name: s.scorerName ?? null,
    })),
  );
  if (stepError) throw new Error(`game_story_steps: ${stepError.message}`);
  await markReliveChecked(db, gameId);
}

/**
 * One MLB game's story from `/v1/game/{gamePk}/winProbability`.
 * Returns null when MLB publishes no win probability for the game, which is normal for older seasons.
 */
export async function buildMlbRelive(
  db: MinimalDb,
  client: MlbClient,
  game: ReliveTarget,
): Promise<{ points: number; steps: number } | null> {
  const entries = await client.getJson<RawEntry[]>(
    `v1/game/${game.provider_game_id}/winProbability`,
  );
  const points = parseWinProbability(entries);
  if (points.length === 0) {
    await markReliveChecked(db, game.game_id);
    return null;
  }
  const steps = await resolveStepScorers(
    db,
    'mlb',
    buildStorySteps(entries, points, {
      awayScore: game.away_score ?? 0,
      homeScore: game.home_score ?? 0,
      awayName: game.away_name,
      homeName: game.home_name,
    }),
  );
  await writeRelive(db, game.game_id, points, steps);
  return { points: points.length, steps: steps.length };
}

export interface DrainResult {
  /** Provider game ids whose detail was written from the queue. */
  detailed: string[];
  /** Provider game ids that now have a story. */
  relived: string[];
  /** Provider game ids with no win probability published; checked and left. */
  noStory: string[];
  errors: string[];
}

export interface DrainOptions {
  /** Queue rows to take per run. An Edge Function run has a wall-clock limit; the rest wait 15 minutes. */
  detailLimit?: number;
  reliveLimit?: number;
  now?: Date;
}

/**
 * Drains the MLB half of `detail_queue`, then builds stories for attended games that lack one.
 *
 * Two passes, because they have different triggers. Detail is asked for by the queue. A story is
 * owed to any attended game with detail, including one whose detail was already there when it was
 * logged (a friend logged it first), which `enqueue_game_detail` never queues a second time.
 */
export async function drainMlbQueue(
  db: MinimalDb,
  provider: { fetchGameDetail(providerGameId: string): Promise<CanonicalGameDetail> },
  client: MlbClient,
  ctx: GameWriteContext,
  opts: DrainOptions = {},
): Promise<DrainResult> {
  const now = opts.now ?? new Date();
  const result: DrainResult = { detailed: [], relived: [], noStory: [], errors: [] };

  const { data, error } = await db.rpc('detail_queue_pending', {
    p_provider: 'mlb',
    p_limit: opts.detailLimit ?? 5,
  });
  if (error) throw new Error(`detail_queue_pending: ${error.message}`);
  const pending = (data ?? []) as { game_id: string; provider_game_id: string; attempts: number }[];

  for (const row of pending) {
    try {
      const detail = await provider.fetchGameDetail(row.provider_game_id);
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

  // Rows whose detail arrived by another path (the daily job, a manual --pks run) close here.
  const { error: settleError } = await db.rpc('detail_queue_settle');
  if (settleError) result.errors.push(`detail_queue_settle: ${settleError.message}`);

  for (const game of await reliveTargets(db, 'mlb', opts.reliveLimit ?? 5)) {
    try {
      const built = await buildMlbRelive(db, client, game);
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
