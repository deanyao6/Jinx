/**
 * Famous games: resolve seed/famous_games.json to games and write the curated rows, then rebuild
 * the schedule rows (championships and the two games before them).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/famous/curated.ts [--check]
 *
 * Each entry names a sport, the home and away abbreviations as in `teams` for that season, and
 * the game's LOCAL date, matched in the venue's timezone (`localDateOf`), because
 * games.scheduled_start is UTC and an 8 pm Eastern game is stored on the next day. An entry
 * that matches no game or more than one refuses the whole run before anything is written
 * (doubleheaders: add `game_number`). `--check` resolves and prints without writing.
 *
 * Idempotent: curated rows are upserted by (game_id, 'curated') and a row whose entry was
 * removed from the file is deleted. Adding a game for another team is one line in the file.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  matchCuratedGame,
  selectAll,
  upsertRows,
  type CuratedFamousGame,
  type MatchableGame,
  type MinimalDb,
} from '@jinx/core';

import { createDb } from '../db.js';
import { flag } from './players.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const CURATED_FILE = path.join(ROOT, 'seed', 'famous_games.json');

const CATEGORIES = new Set(['championship', 'playoff', 'record', 'debut', 'farewell']);
const EM_DASH = String.fromCharCode(0x2014);

/** Shape and copy checks that need no database. Returns the problems, empty when the file is fine. */
export function validateCurated(entries: readonly CuratedFamousGame[]): string[] {
  const problems: string[] = [];
  entries.forEach((e, i) => {
    const at = `entry ${i + 1} (${e.local_date} ${e.away} at ${e.home})`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.local_date ?? ''))
      problems.push(`${at}: local_date must be YYYY-MM-DD`);
    if (!e.sport || !e.home || !e.away) problems.push(`${at}: sport, home and away are required`);
    if (!CATEGORIES.has(e.category))
      problems.push(`${at}: category must be one of ${[...CATEGORIES].join(', ')}`);
    if (!e.title || e.title.length > 120)
      problems.push(`${at}: title is required, at most 120 characters`);
    for (const text of [e.title, e.story]) {
      if (text?.includes(EM_DASH)) problems.push(`${at}: no em dashes in UI copy`);
    }
    if (e.about !== 'league' && !(e.about && typeof e.about === 'object' && e.about.team)) {
      problems.push(`${at}: about is "league" or { "team": "PHI" }`);
    }
  });
  return problems;
}

interface TeamRow {
  id: string;
  sport_id: string;
  abbreviation: string;
}
interface GameRow {
  id: string;
  sport_id: string;
  scheduled_start: string;
  venue_id: string | null;
  home_team_id: string;
  away_team_id: string;
  doubleheader_number: number | null;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface Resolved {
  entry: CuratedFamousGame;
  gameId: string;
  aboutTeamId: string | null;
}

/** Every entry to exactly one game, or an error listing every entry that did not. */
export async function resolveCurated(
  db: MinimalDb,
  entries: readonly CuratedFamousGame[],
): Promise<Resolved[]> {
  const teams = await selectAll<TeamRow>(db, 'teams', 'id, sport_id, abbreviation');
  const teamId = (sport: string, abbr: string) =>
    teams.find((t) => t.sport_id === sport && t.abbreviation === abbr)?.id;
  const abbrOf = new Map(teams.map((t) => [t.id, t.abbreviation]));
  const venues = await selectAll<{ id: string; tz: string | null }>(db, 'venues', 'id, tz');
  const tzOf = new Map(venues.map((v) => [v.id, v.tz]));

  const out: Resolved[] = [];
  const errors: string[] = [];
  for (const e of entries) {
    const at = `${e.sport} ${e.local_date} ${e.away} at ${e.home}`;
    const home = teamId(e.sport, e.home);
    const away = teamId(e.sport, e.away);
    if (!home || !away) {
      errors.push(`${at}: unknown team abbreviation ${!home ? e.home : e.away}`);
      continue;
    }
    // The local date is the UTC date or the one before it, so a two-day UTC window holds it.
    const { data, error } = await db
      .from('games')
      .select(
        'id, sport_id, scheduled_start, venue_id, home_team_id, away_team_id, doubleheader_number',
      )
      .eq('sport_id', e.sport)
      .eq('home_team_id', home)
      .eq('away_team_id', away)
      .gte('scheduled_start', `${e.local_date}T00:00:00Z`)
      .lt('scheduled_start', `${addDays(e.local_date, 2)}T00:00:00Z`);
    if (error) throw new Error(`games lookup: ${error.message}`);
    const candidates: MatchableGame[] = ((data ?? []) as GameRow[]).map((g) => ({
      id: g.id,
      sport_id: g.sport_id,
      scheduled_start: g.scheduled_start,
      venue_tz: g.venue_id ? (tzOf.get(g.venue_id) ?? null) : null,
      home_abbreviation: abbrOf.get(g.home_team_id) ?? '',
      away_abbreviation: abbrOf.get(g.away_team_id) ?? '',
      doubleheader_number: g.doubleheader_number,
    }));
    const hits = matchCuratedGame(e, candidates);
    if (hits.length !== 1) {
      errors.push(
        hits.length === 0
          ? `${at}: no game on that local date`
          : `${at}: ${hits.length} games on that date; add "game_number"`,
      );
      continue;
    }
    let aboutTeamId: string | null = null;
    if (e.about !== 'league') {
      aboutTeamId = teamId(e.sport, e.about.team) ?? null;
      if (!aboutTeamId) {
        errors.push(`${at}: unknown "about" team ${e.about.team}`);
        continue;
      }
    }
    out.push({ entry: e, gameId: hits[0]!.id, aboutTeamId });
  }
  if (errors.length > 0)
    throw new Error(
      `refusing to build, ${errors.length} entr${errors.length === 1 ? 'y' : 'ies'} did not resolve:\n  ${errors.join('\n  ')}`,
    );
  const dupes = out.filter((r, i) => out.findIndex((x) => x.gameId === r.gameId) !== i);
  if (dupes.length > 0)
    throw new Error(
      `refusing to build: two entries name the same game (${dupes.map((d) => d.entry.title).join(', ')})`,
    );
  return out;
}

/** Write the curated rows and drop the ones no longer in the file. */
export async function writeCurated(
  db: MinimalDb,
  resolved: readonly Resolved[],
): Promise<{ written: number; removed: number }> {
  await upsertRows(
    db,
    'famous_games',
    resolved.map((r) => ({
      game_id: r.gameId,
      source: 'curated',
      category: r.entry.category,
      title: r.entry.title,
      story: r.entry.story,
      about_team_id: r.aboutTeamId,
    })),
    'game_id,source',
  );
  const keep = new Set(resolved.map((r) => r.gameId));
  const existing = await selectAll<{ id: string; game_id: string }>(
    db,
    'famous_games',
    'id, game_id',
    (q) => q.eq('source', 'curated'),
  );
  const stale = existing.filter((r) => !keep.has(r.game_id)).map((r) => r.id);
  for (const id of stale) {
    const { error } = await db.from('famous_games').delete().eq('id', id);
    if (error) throw new Error(`delete famous_games: ${error.message}`);
  }
  return { written: resolved.length, removed: stale.length };
}

async function main(): Promise<void> {
  const entries = JSON.parse(readFileSync(CURATED_FILE, 'utf8')) as CuratedFamousGame[];
  const problems = validateCurated(entries);
  if (problems.length > 0) throw new Error(`seed/famous_games.json:\n  ${problems.join('\n  ')}`);
  const db = createDb();
  const resolved = await resolveCurated(db, entries);
  for (const r of resolved)
    console.log(`${r.entry.local_date} ${r.entry.away} at ${r.entry.home}: ${r.entry.title}`);
  if (flag('check')) {
    console.log(`${resolved.length} entries resolve to one game each (--check: nothing written)`);
    return;
  }
  const w = await writeCurated(db, resolved);
  console.log(`curated: ${w.written} written, ${w.removed} removed`);
  const { data, error } = await db.rpc('rebuild_schedule_famous_games');
  if (error) throw new Error(`rebuild_schedule_famous_games: ${error.message}`);
  console.log(`schedule: ${String(data)} rows`);
}

const isEntrypoint = process.argv[1] != null && /[\\/]curated\.ts$/.test(process.argv[1]);
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
