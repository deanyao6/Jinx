/**
 * NBA schedule + finals sync (SPEC.md 4.5), every 15 minutes, the NBA twin of mlb-sync/sync.ts.
 *  1. Upsert the CDN schedule for [today - 3 days, today + 14 days]: tip-off times, arenas,
 *     statuses and scores for every game, which is all an unlogged game ever gets.
 *  2. Re-fetch detail once, about 12 hours after the game ended, for games that already have it
 *     and that someone logged, to pick up box score corrections (SPEC.md 4.7).
 *
 * First-time detail is not fetched here: `drainNbaQueue` runs right after this in index.ts.
 */
import {
  NbaProvider,
  detailContextFor,
  loadTeamMap,
  loadVenueMaps,
  upsertGameDetail,
  upsertGames,
  type GameWriteContext,
  type MinimalDb,
} from '../_shared/core/index.ts';
import { dueForRecheck, loggedGameIds, syncWindow, type RecheckRow, type SyncResult } from '../mlb-sync/sync.ts';

export async function runNbaSync(
  db: MinimalDb,
  provider: NbaProvider,
  now = new Date(),
): Promise<SyncResult> {
  const ctx: GameWriteContext = {
    teamMap: await loadTeamMap(db, 'nba'),
    venueMaps: await loadVenueMaps(db),
    venueLookup: 'nba',
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
    .eq('provider', 'nba')
    .eq('status', 'final')
    .gte('scheduled_start', sinceIso)
    .not('detail_ingested_at', 'is', null)
    .is('detail_rechecked_at', null)
    .limit(200);
  if (error) throw new Error(error.message);

  const due = ((data ?? []) as RecheckRow[]).filter((g) => dueForRecheck(g, now));
  const logged = await loggedGameIds(db, due.map((g) => g.id));

  for (const g of due) {
    if (!logged.has(g.id)) continue;
    try {
      const detail = await provider.fetchGameDetail(
        g.provider_game_id,
        await detailContextFor(db, g.id, g.provider_game_id),
      );
      await upsertGameDetail(db, detail, ctx);
      await db.from('games').update({ detail_rechecked_at: now.toISOString() }).eq('id', g.id);
      result.rechecked.push(g.provider_game_id);
    } catch (err) {
      result.errors.push(`${g.provider_game_id}: ${String(err)}`);
    }
  }
  return result;
}
