/**
 * Which upcoming games get storylines: the ones someone is going to, soonest first.
 *
 * The window is applied to `games` on the server first, and only then are attendances consulted,
 * for those games alone and a page at a time. Reading every "going" attendance in one request and
 * filtering afterwards stops at PostgREST's 1,000 rows, and what falls off the end is silent.
 */
import { chunk, selectAll, type MinimalDb } from '../_shared/core/index.ts';

export interface GameRow {
  id: string;
  sport_id: string;
  season: number;
  game_type: string;
  status: string;
  scheduled_start: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
}

export const GAME_COLUMNS =
  'id, sport_id, season, game_type, status, scheduled_start, home_team_id, away_team_id, home_score, away_score';

export async function goingGamesInWindow(
  db: MinimalDb,
  from: Date,
  until: Date,
  max: number,
): Promise<GameRow[]> {
  // Soonest first, so the ceiling on one call drops the games that can best afford to wait.
  const scheduled = await selectAll<GameRow>(db, 'games', GAME_COLUMNS, (q) =>
    q
      .eq('status', 'scheduled')
      .gte('scheduled_start', from.toISOString())
      .lt('scheduled_start', until.toISOString())
      .order('scheduled_start', { ascending: true })
      .order('id', { ascending: true }),
  );
  if (scheduled.length === 0) return [];

  // A popular game can have more people going than fit in one response, hence the paging; the
  // order makes the pages stable. Ids go a hundred at a time because they travel in the URL.
  const wanted = new Set<string>();
  for (const ids of chunk(
    scheduled.map((g) => g.id),
    100,
  )) {
    const going = await selectAll<{ game_id: string }>(db, 'attendances', 'id, game_id', (q) =>
      q.eq('status', 'going').in('game_id', ids).order('id', { ascending: true }),
    );
    for (const r of going) wanted.add(r.game_id);
  }
  return scheduled.filter((g) => wanted.has(g.id)).slice(0, max);
}
