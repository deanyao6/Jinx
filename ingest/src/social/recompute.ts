/**
 * Runs the same badge and streak evaluation as the `evaluate-social` Edge Function, from Node,
 * against whatever SUPABASE_URL points at. Useful for local development without standing up
 * `supabase functions serve`; the Edge Function is what actually runs in production, called from
 * `process_game_final` / `attendances_after_write` (`evaluate_social_for_users`).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/social/recompute.ts <user_id> [...]
 */
import { BADGE_CATALOG, computeSeasonStreak, evaluateGoal, type GoalGame, type SeasonCount } from '@jinx/core';

import { createDb } from '../db.js';

interface SeasonCountRow {
  team_id: string;
  sport_id: string;
  season: number;
  games: number;
}
interface SeasonStatusRow {
  sport_id: string;
  season: number;
  ended: boolean;
}

async function recomputeOne(db: ReturnType<typeof createDb>, userId: string, status: Map<string, SeasonStatusRow>) {
  const { data: gamesData, error: gErr } = await db.rpc('goal_games', { p_user: userId });
  if (gErr) throw new Error(gErr.message);
  const games = (gamesData ?? []) as GoalGame[];

  const { data: earnedRows, error: earnedErr } = await db
    .from('user_badges')
    .select('badge_key')
    .eq('user_id', userId);
  if (earnedErr) throw new Error(earnedErr.message);
  const earned = new Set((earnedRows as unknown as { badge_key: string }[]).map((r) => r.badge_key));

  let badgesAwarded = 0;
  for (const badge of BADGE_CATALOG) {
    if (earned.has(badge.key)) continue;
    if (!evaluateGoal(badge.criteria, games).completed) continue;
    const { data: inserted, error: insErr } = await db
      .from('user_badges')
      .insert([{ user_id: userId, badge_key: badge.key, context: {} }])
      .select('badge_key');
    if (insErr) throw new Error(insErr.message);
    if (!inserted || (inserted as unknown[]).length === 0) continue;
    badgesAwarded++;
    const { error: feedErr } = await db.from('feed_events').insert([
      { actor_user_id: userId, type: 'badge_earned', payload: { badge_key: badge.key, name: badge.name, tier: badge.tier } },
    ]);
    if (feedErr) throw new Error(feedErr.message);
    const { error: notifErr } = await db.from('notifications').insert([
      { user_id: userId, kind: 'badge_earned', title: 'Badge earned', body: badge.name, data: { badge_key: badge.key } },
    ]);
    if (notifErr) throw new Error(notifErr.message);
  }

  const { data: countRows, error: countErr } = await db.rpc('season_game_counts', { p_user: userId });
  if (countErr) throw new Error(countErr.message);
  const byTeam = new Map<string, { sportId: string; counts: SeasonCount[] }>();
  for (const row of (countRows ?? []) as unknown as SeasonCountRow[]) {
    const entry = byTeam.get(row.team_id) ?? { sportId: row.sport_id, counts: [] };
    entry.counts.push({ season: row.season, games: row.games });
    byTeam.set(row.team_id, entry);
  }
  const streakRows: Record<string, unknown>[] = [];
  for (const [teamId, entry] of byTeam) {
    const st = status.get(entry.sportId);
    if (!st) continue;
    const streak = computeSeasonStreak(entry.counts, st.season, st.ended);
    if (!streak) continue;
    streakRows.push({
      user_id: userId,
      team_id: teamId,
      sport_id: entry.sportId,
      start_season: streak.startSeason,
      end_season: streak.endSeason,
      seasons: streak.seasons,
      min_games: streak.minGames,
      is_active: streak.isActive,
      updated_at: new Date().toISOString(),
    });
  }
  const { error: delErr } = await db.from('season_streaks').delete().eq('user_id', userId);
  if (delErr) throw new Error(delErr.message);
  if (streakRows.length > 0) {
    const { error: insStreakErr } = await db.from('season_streaks').insert(streakRows);
    if (insStreakErr) throw new Error(insStreakErr.message);
  }

  await db.rpc('recompute_user_counts', { p_user: userId });
  await db.rpc('recompute_user_leaderboard_stats', { p_user: userId });

  return { badgesAwarded, streaksWritten: streakRows.length };
}

async function main() {
  const userIds = process.argv.slice(2);
  if (userIds.length === 0) throw new Error('usage: recompute.ts <user_id> [...]');
  const db = createDb();
  const { data: statusData, error: statusErr } = await db.rpc('season_status');
  if (statusErr) throw new Error(statusErr.message);
  const status = new Map(
    ((statusData ?? []) as unknown as SeasonStatusRow[]).map((r) => [r.sport_id, r] as const),
  );
  for (const userId of userIds) {
    const result = await recomputeOne(db, userId, status);
    console.log(userId, result);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
