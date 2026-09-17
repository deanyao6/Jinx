/**
 * MLB schedule + finals sync (SPEC.md 4.5): every 15 minutes during game windows.
 *  1. Upsert the schedule for [today - 3 days, today + 14 days]. Scores and statuses for every
 *     game come from here, and that is all an unlogged game ever gets.
 *  2. Re-fetch detail once, about 12 hours after the game ended, for games that already have it
 *     and that someone logged, to pick up scoring corrections (SPEC.md 4.7).
 *
 * First-time detail is not fetched here. SPEC.md 4.7 stores detail only for games someone cares
 * about, and `detail_queue` is how a game says so: `drainMlbQueue` runs right after this in
 * index.ts and fetches exactly those.
 */
import {
  MlbProvider,
  loadTeamMap,
  loadVenueMaps,
  upsertGameDetail,
  upsertGames,
  type GameWriteContext,
  type MinimalDb,
} from '../_shared/core/index.ts';

export interface SyncWindow {
  start: string;
  end: string;
}

export function syncWindow(now: Date, pastDays = 3, futureDays = 14): SyncWindow {
  const day = (offset: number) =>
    new Date(now.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
  return { start: day(-pastDays), end: day(futureDays) };
}

export interface SyncResult {
  scheduled: number;
  rechecked: string[];
  errors: string[];
}

export interface RecheckRow {
  id: string;
  provider_game_id: string;
  scheduled_start: string;
  detail_ingested_at: string;
}

const RECHECK_AFTER_MS = 16 * 3_600_000;

/**
 * True when a game's detail was fetched soon after it ended and enough time has passed since for
 * corrections to have landed. Measured from the scheduled start, which every game has, where
 * `final_at` is missing for some: 16 hours from first pitch is about 12 from the last out.
 */
export function dueForRecheck(g: RecheckRow, now: Date): boolean {
  const startedMs = Date.parse(g.scheduled_start);
  return (
    now.getTime() - startedMs > RECHECK_AFTER_MS &&
    Date.parse(g.detail_ingested_at) - startedMs < RECHECK_AFTER_MS
  );
}

/**
 * The games among `gameIds` that someone logged. The queue answers for nearly all of them with one
 * row per game, so the 1,000-row cap cannot bite. A game whose detail predates its first
 * attendance never entered the queue (`enqueue_game_detail` skips a game that has detail), so
 * anything the queue does not know is asked about on its own, one row each.
 */
export async function loggedGameIds(db: MinimalDb, gameIds: string[]): Promise<Set<string>> {
  const logged = new Set<string>();
  if (gameIds.length === 0) return logged;
  const { data, error } = await db.from('detail_queue').select('game_id').in('game_id', gameIds);
  if (error) throw new Error(error.message);
  for (const r of (data ?? []) as { game_id: string }[]) logged.add(r.game_id);

  for (const id of gameIds) {
    if (logged.has(id)) continue;
    const { data: rows, error: attendanceError } = await db
      .from('attendances')
      .select('game_id')
      .eq('game_id', id)
      .limit(1);
    if (attendanceError) throw new Error(attendanceError.message);
    if ((rows ?? []).length > 0) logged.add(id);
  }
  return logged;
}

export async function runMlbSync(
  db: MinimalDb,
  provider: MlbProvider,
  now = new Date(),
): Promise<SyncResult> {
  const ctx: GameWriteContext = {
    teamMap: await loadTeamMap(db, 'mlb'),
    venueMaps: await loadVenueMaps(db),
    venueLookup: 'mlb',
  };
  const result: SyncResult = { scheduled: 0, rechecked: [], errors: [] };

  const window = syncWindow(now);
  const games = (await provider.fetchSchedule(window)).filter(
    (g) => ctx.teamMap.has(g.homeProviderTeamId) && ctx.teamMap.has(g.awayProviderTeamId),
  );
  await upsertGames(db, games, ctx);
  result.scheduled = games.length;

  const sinceIso = new Date(now.getTime() - 3 * 86_400_000).toISOString();
  const { data, error } = await db
    .from('games')
    .select('id, provider_game_id, scheduled_start, detail_ingested_at')
    .eq('provider', 'mlb')
    .eq('status', 'final')
    .gte('scheduled_start', sinceIso)
    .not('detail_ingested_at', 'is', null)
    .is('detail_rechecked_at', null)
    .limit(200);
  if (error) throw new Error(error.message);

  const due = ((data ?? []) as RecheckRow[]).filter((g) => dueForRecheck(g, now));
  const logged = await loggedGameIds(
    db,
    due.map((g) => g.id),
  );

  for (const g of due) {
    if (!logged.has(g.id)) continue;
    try {
      const detail = await provider.fetchGameDetail(g.provider_game_id);
      await upsertGameDetail(db, detail, ctx);
      await db.from('games').update({ detail_rechecked_at: now.toISOString() }).eq('id', g.id);
      result.rechecked.push(g.provider_game_id);
    } catch (err) {
      result.errors.push(`${g.provider_game_id}: ${String(err)}`);
    }
  }
  return result;
}
