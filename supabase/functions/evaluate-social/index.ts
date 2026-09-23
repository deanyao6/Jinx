/**
 * evaluate-social: badges (SPEC 6.13, R6) and season streaks for the given users, both from
 * `packages/core` (badges reuse the goals predicate evaluator; streaks use `computeSeasonStreak`).
 * Body: { user_ids: string[] }. Called from process_game_final and attendances_after_write via
 * pg_cron/pg_net (`evaluate_social_for_users`), or ad hoc.
 */
import {
  BADGE_CATALOG,
  computeSeasonStreak,
  evaluateGoal,
  type GoalGame,
  type SeasonCount,
} from '../_shared/core/index.ts';
import { authorizeInternal, json, serviceDb } from '../_shared/db.ts';

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

Deno.serve(async (req) => {
  if (!authorizeInternal(req)) return json({ error: 'unauthorized' }, 401);
  let body: { user_ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid body' }, 400);
  }
  const users = [...new Set(body.user_ids ?? [])].slice(0, 500);
  const db = serviceDb();
  let badgesAwarded = 0;
  let streaksWritten = 0;
  const errors: string[] = [];

  const { data: statusData, error: statusErr } = await db.rpc('season_status');
  if (statusErr) return json({ error: statusErr.message }, 500);
  const status = new Map(
    ((statusData ?? []) as SeasonStatusRow[]).map((r) => [r.sport_id, r] as const),
  );

  for (const userId of users) {
    try {
      const { data: gamesData, error: gErr } = await db.rpc('goal_games', { p_user: userId });
      if (gErr) throw new Error(gErr.message);
      const games = (gamesData ?? []) as GoalGame[];

      // --- Badges -----------------------------------------------------------------------
      const { data: earnedRows, error: earnedErr } = await db
        .from('user_badges')
        .select('badge_key')
        .eq('user_id', userId);
      if (earnedErr) throw new Error(earnedErr.message);
      const earned = new Set((earnedRows as { badge_key: string }[]).map((r) => r.badge_key));

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
          {
            actor_user_id: userId,
            type: 'badge_earned',
            payload: { badge_key: badge.key, name: badge.name, tier: badge.tier },
          },
        ]);
        if (feedErr) throw new Error(feedErr.message);
        const { error: notifErr } = await db.from('notifications').insert([
          {
            user_id: userId,
            kind: 'badge_earned',
            title: 'Badge earned',
            body: badge.name,
            data: { badge_key: badge.key },
          },
        ]);
        if (notifErr) throw new Error(notifErr.message);
      }

      // --- Season streaks -----------------------------------------------------------------
      const { data: countRows, error: countErr } = await db.rpc('season_game_counts', {
        p_user: userId,
      });
      if (countErr) throw new Error(countErr.message);
      const byTeam = new Map<string, { sportId: string; counts: SeasonCount[] }>();
      for (const row of (countRows ?? []) as SeasonCountRow[]) {
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
      streaksWritten += streakRows.length;
    } catch (err) {
      errors.push(`${userId}: ${String(err)}`);
    }
  }
  return json({ users: users.length, badgesAwarded, streaksWritten, errors });
});
