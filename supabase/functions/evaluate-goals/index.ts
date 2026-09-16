/**
 * evaluate-goals: re-evaluates goals and bucket lists for the given users using the core evaluator,
 * records progress, and marks completions (which trigger feed events and notifications in SQL).
 * Body: { user_ids: string[] }. Called from process_game_final via pg_cron/pg_net, or ad hoc.
 */
import { evaluateGoal, validateGoalDefinition, type GoalGame } from '../_shared/core/index.ts';
import { authorizeInternal, json, serviceDb } from '../_shared/db.ts';

interface GoalRow {
  id: string;
  user_id: string;
  definition: unknown;
  completed_at: string | null;
}
interface ListRow {
  bucket_list_id: string;
  definition: unknown;
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
  let goalsUpdated = 0;
  let listsUpdated = 0;
  const errors: string[] = [];
  for (const userId of users) {
    try {
      const { data: gamesData, error: gErr } = await db.rpc('goal_games', { p_user: userId });
      if (gErr) throw new Error(gErr.message);
      const games = (gamesData ?? []) as GoalGame[];

      const { data: goals, error: goalErr } = await db
        .from('goals')
        .select('id, user_id, definition, completed_at')
        .eq('user_id', userId);
      if (goalErr) throw new Error(goalErr.message);
      for (const goal of (goals ?? []) as GoalRow[]) {
        if (!validateGoalDefinition(goal.definition)) continue;
        const progress = evaluateGoal(goal.definition, games);
        const patch: Record<string, unknown> = { progress };
        if (progress.completed && !goal.completed_at)
          patch['completed_at'] = new Date().toISOString();
        const { error } = await db.from('goals').update(patch).eq('id', goal.id);
        if (error) throw new Error(error.message);
        goalsUpdated++;
      }

      const { data: lists, error: listErr } = await db
        .from('user_bucket_lists')
        .select('bucket_list_id, definition:bucket_lists(definition)')
        .eq('user_id', userId);
      if (listErr) throw new Error(listErr.message);
      for (const row of (lists ?? []) as unknown as {
        bucket_list_id: string;
        definition: { definition: unknown } | null;
      }[]) {
        const def = row.definition?.definition;
        if (!validateGoalDefinition(def)) continue;
        const progress = evaluateGoal(def, games);
        const { error } = await db
          .from('user_bucket_lists')
          .update({ progress })
          .eq('user_id', userId)
          .eq('bucket_list_id', row.bucket_list_id);
        if (error) throw new Error(error.message);
        listsUpdated++;
      }
    } catch (err) {
      errors.push(`${userId}: ${String(err)}`);
    }
  }
  return json({ users: users.length, goalsUpdated, listsUpdated, errors });
});
