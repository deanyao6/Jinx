/**
 * nba-live: reads the CDN's live scoreboard for NBA games that have an active check-in and
 * writes `game_live_state` (SPEC.md 6.4; the NBA lock rule is the end of the first quarter).
 * Scheduled every minute by pg_cron, guarded by games_needing_live_poll() so it only runs
 * while someone is at a game. One request serves every game on the scoreboard.
 */
import { NbaProvider, estimatedLock } from '../_shared/core/index.ts';
import { authorizeInternal, json, serviceDb } from '../_shared/db.ts';

interface Row {
  game_id: string;
  provider_game_id: string;
  sport_id: string;
  scheduled_start: string;
}

Deno.serve(async (req) => {
  if (!authorizeInternal(req)) return json({ error: 'unauthorized' }, 401);
  const db = serviceDb();
  const provider = new NbaProvider();
  const { data, error } = await db.rpc('games_needing_live_poll');
  if (error) return json({ error: error.message }, 500);
  const rows = ((data ?? []) as Row[]).filter((r) => r.sport_id === 'nba');
  const now = new Date().toISOString();
  const updated: string[] = [];
  const errors: string[] = [];
  for (const g of rows) {
    try {
      const live = await provider.fetchLiveState(g.provider_game_id);
      const lock = estimatedLock('nba', g.scheduled_start, live, now);
      await db.from('game_live_state').upsert(
        [
          {
            game_id: g.game_id,
            status: live.status,
            inning: live.inning,
            inning_state: live.inningState,
            clock: live.clock ?? null,
            home_score: live.homeScore,
            away_score: live.awayScore,
            locked: lock.locked,
            lock_reason: lock.reason,
            fetched_at: live.fetchedAt,
          },
        ],
        { onConflict: 'game_id' },
      );
      if (live.status === 'live' || live.status === 'final') {
        await db
          .from('games')
          .update({ status: live.status })
          .eq('id', g.game_id)
          .neq('status', 'final');
      }
      updated.push(g.provider_game_id);
    } catch (err) {
      errors.push(`${g.provider_game_id}: ${String(err)}`);
    }
  }
  return json({ polled: rows.length, updated, errors });
});
