/**
 * MLB schedule + finals sync (SPEC.md 4.5): every 15 minutes during game windows.
 *  1. Upsert the schedule for [today - 3 days, today + 14 days].
 *  2. Fetch details for games that went final and lack detail, and re-fetch each final game once
 *     about 12 hours after it ended to pick up corrections.
 *  3. Run post-final processing for every game whose detail was (re)ingested.
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
  detailed: string[];
  rechecked: string[];
  errors: string[];
}

interface GameRow {
  id: string;
  provider_game_id: string;
  final_at: string | null;
  scheduled_start: string;
  detail_ingested_at: string | null;
  detail_rechecked_at: string | null;
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
  const result: SyncResult = { scheduled: 0, detailed: [], rechecked: [], errors: [] };

  const window = syncWindow(now);
  const games = (await provider.fetchSchedule(window)).filter(
    (g) => ctx.teamMap.has(g.homeProviderTeamId) && ctx.teamMap.has(g.awayProviderTeamId),
  );
  await upsertGames(db, games, ctx);
  result.scheduled = games.length;

  const sinceIso = new Date(now.getTime() - 3 * 86_400_000).toISOString();
  const { data, error } = await db
    .from('games')
    .select(
      'id, provider_game_id, final_at, scheduled_start, detail_ingested_at, detail_rechecked_at',
    )
    .eq('provider', 'mlb')
    .eq('status', 'final')
    .gte('scheduled_start', sinceIso)
    .limit(200);
  if (error) throw new Error(error.message);

  for (const g of (data ?? []) as GameRow[]) {
    const needsFirst = g.detail_ingested_at === null;
    const startedMs = Date.parse(g.scheduled_start);
    const needsRecheck =
      !needsFirst &&
      g.detail_rechecked_at === null &&
      now.getTime() - startedMs > 16 * 3_600_000 &&
      Date.parse(g.detail_ingested_at!) - startedMs < 16 * 3_600_000;
    if (!needsFirst && !needsRecheck) continue;
    try {
      const detail = await provider.fetchGameDetail(g.provider_game_id);
      await upsertGameDetail(db, detail, ctx);
      if (needsRecheck) {
        await db.from('games').update({ detail_rechecked_at: now.toISOString() }).eq('id', g.id);
        result.rechecked.push(g.provider_game_id);
      } else {
        result.detailed.push(g.provider_game_id);
      }
    } catch (err) {
      result.errors.push(`${g.provider_game_id}: ${String(err)}`);
    }
  }
  return result;
}
