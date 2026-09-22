/**
 * MLS `final_at`: when a match actually ended, from ESPN's summary.
 *
 *   npx tsx ingest/src/mls/finals.ts --attended          # matches someone logged (default)
 *   npx tsx ingest/src/mls/finals.ts --recent 14         # finals of the last N days too
 *   npx tsx ingest/src/mls/finals.ts --events 761829,761828
 *
 * The scoreboard carries no wall clock, so the schedule pass stores an estimate from the display
 * clock (`mlsScoreboardFinalAt`); the summary's key events do carry one, and this replaces the
 * estimate with it for the matches that matter: the ones a fan attended (the check-in window
 * closes an hour after `final_at`) and, in the daily job, the last two weeks of finals. One
 * request a second, cached on disk for a day. A wall clock outside four hours of kickoff is
 * ESPN's re-processing time on an old match and is refused (docs/verification.md, 2026-09-22).
 */
import { mlsSummaryFinalAt, type DbBuilder } from '@jinx/core';

import { createDb, type Db } from '../db.js';
import { mlsProvider } from './provider.js';

interface GameRow {
  id: string;
  provider_game_id: string;
  scheduled_start: string;
  final_at: string | null;
}

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function selectGames(db: Db, filter: (q: DbBuilder) => DbBuilder): Promise<GameRow[]> {
  const out: GameRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(
      db
        .from('games')
        .select('id, provider_game_id, scheduled_start, final_at')
        .eq('provider', 'espn_mls')
        .eq('status', 'final'),
    ).range(from, from + 999);
    if (error) throw new Error(`games: ${error.message}`);
    out.push(...((data ?? []) as GameRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function wantedGames(db: Db, recentDays: number, events: string[]): Promise<GameRow[]> {
  const byId = new Map<string, GameRow>();
  if (events.length > 0) {
    for (const g of await selectGames(db, (q) => q.in('provider_game_id', events))) byId.set(g.id, g);
    return [...byId.values()];
  }
  // Attended (any status: a "going" flips to attended at the final): through the attendances
  // relation so PostgREST filters server-side and the 1000-row cap never hides a game.
  const { data, error } = await db
    .from('attendances')
    .select('game_id, games!inner(id, provider_game_id, scheduled_start, final_at, provider, status)')
    .eq('games.provider', 'espn_mls')
    .eq('games.status', 'final')
    .limit(1000);
  if (error) throw new Error(`attendances: ${error.message}`);
  for (const row of (data ?? []) as { games: GameRow }[]) byId.set(row.games.id, row.games);
  if (recentDays > 0) {
    const since = new Date(Date.now() - recentDays * 86_400_000).toISOString();
    for (const g of await selectGames(db, (q) => q.gte('scheduled_start', since))) byId.set(g.id, g);
  }
  return [...byId.values()];
}

async function main(): Promise<void> {
  const db = createDb();
  const recent = Number(argValue('recent') ?? 0);
  const events = (argValue('events') ?? '').split(',').filter(Boolean);
  const games = await wantedGames(db, recent, events);
  const provider = mlsProvider();
  let exact = 0;
  let kept = 0;
  for (const g of games) {
    const summary = await provider.summary(g.provider_game_id);
    const finalAt = mlsSummaryFinalAt(summary, g.scheduled_start);
    if (!finalAt) {
      kept++;
      console.log(`${g.provider_game_id}: no usable wall clock, keeping ${g.final_at ?? 'null'}`);
      continue;
    }
    const { error } = await db.from('games').update({ final_at: finalAt }).eq('id', g.id);
    if (error) throw new Error(`update ${g.provider_game_id}: ${error.message}`);
    exact++;
    console.log(`${g.provider_game_id}: ended ${finalAt} (was ${g.final_at ?? 'null'})`);
  }
  console.log(`${games.length} matches: ${exact} set from the summary, ${kept} kept`);
}

const isEntrypoint = process.argv[1] != null && /[\\/]finals\.ts$/.test(process.argv[1]);
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
