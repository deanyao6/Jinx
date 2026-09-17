/**
 * storylines: pregame storylines for upcoming games (SPEC.md 6.18, as narrowed 2026-09-17).
 *
 * At most one storyline per team, plus one about the game only when the schedule says it is a big
 * one. The database enforces that shape with a unique index; this function just fills it.
 *
 * The pipeline, and where each guarantee lives:
 *
 *   facts        packages/core/src/storylines/facts.ts        computed from results, never inferred
 *   significance packages/core/src/storylines/significance.ts decided from the schedule, not the model
 *   model        here                                          one sentence from the facts as JSON
 *   validation   packages/core/src/storylines/validate.ts     every number, team and name checked
 *
 * A sentence that fails validation is retried with the specific reason, up to MAX_ATTEMPTS, and
 * failing that is not stored at all. No storyline is always better than a wrong one.
 *
 * Internal only: pg_cron or an operator with the service role key. Users never call this.
 *
 * Body, one of:
 *   { "game_ids": ["..."] }          these games
 *   { "upcoming_hours": 36 }         games someone is going to that start within the window
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import {
  hasSomethingToSay,
  retryPrompt,
  significance,
  significancePrompt,
  STORYLINE_SYSTEM,
  teamFacts,
  teamPrompt,
  validateStoryline,
  type MinimalDb,
  type ScheduleGame,
  type TeamName,
} from '../_shared/core/index.ts';
import { authorizeInternal, json, serviceDb } from '../_shared/db.ts';

/**
 * The same model as ticket parsing. Writing one factual sentence from a small JSON object is well
 * within it, the validator catches what it gets wrong, and this runs for every upcoming game
 * someone is going to, where cost adds up in a way a one-off ticket does not.
 */
export const STORYLINE_MODEL = 'claude-haiku-4-5';

/** First try plus two corrected retries. */
const MAX_ATTEMPTS = 3;

/** A reasonable ceiling on how many games one call will process. */
const MAX_GAMES = 50;

const Output = z.object({ text: z.string() });

interface GameRow {
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

interface TeamRow {
  id: string;
  name: string;
  city: string | null;
  nickname: string | null;
}

const GAME_COLUMNS =
  'id, sport_id, season, game_type, status, scheduled_start, home_team_id, away_team_id, home_score, away_score';

function toSchedule(g: GameRow): ScheduleGame {
  return {
    gameId: g.id,
    gameType: g.game_type,
    status: g.status as ScheduleGame['status'],
    scheduledStart: g.scheduled_start,
    season: g.season,
    homeTeamId: g.home_team_id,
    awayTeamId: g.away_team_id,
    homeScore: g.home_score,
    awayScore: g.away_score,
  };
}

function shortName(t: TeamRow): string {
  if (t.nickname) return t.nickname;
  return t.city && t.name.startsWith(t.city) ? t.name.slice(t.city.length).trim() : t.name;
}

/**
 * Asks for one sentence and keeps asking, with the validator's reason, until one passes or the
 * attempts run out. Returns null rather than the last failure: an unvalidated sentence is never
 * stored, however close it came.
 */
async function generate(
  client: Anthropic,
  prompt: string,
  facts: unknown,
  ctx: Parameters<typeof validateStoryline>[2],
  log: string[],
  label: string,
): Promise<string | null> {
  let request = prompt;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await client.messages.parse({
      model: STORYLINE_MODEL,
      max_tokens: 300,
      system: STORYLINE_SYSTEM,
      messages: [{ role: 'user', content: request }],
      output_config: { format: zodOutputFormat(Output) },
    });
    const text = response.parsed_output?.text?.trim() ?? '';
    const verdict = validateStoryline(text, facts, ctx);
    if (verdict.ok) {
      log.push(`${label}: accepted on attempt ${attempt}`);
      return text;
    }
    log.push(`${label}: attempt ${attempt} rejected (${verdict.reason}) "${text}"`);
    request = retryPrompt(prompt, text, verdict.reason);
  }
  log.push(`${label}: no valid storyline after ${MAX_ATTEMPTS} attempts, storing none`);
  return null;
}

async function gamesToProcess(
  db: MinimalDb,
  body: { game_ids?: string[]; upcoming_hours?: number },
): Promise<GameRow[]> {
  if (body.game_ids?.length) {
    const { data, error } = await db
      .from('games')
      .select(GAME_COLUMNS)
      .in('id', body.game_ids.slice(0, MAX_GAMES));
    if (error) throw new Error(error.message);
    return (data ?? []) as GameRow[];
  }

  // Only games someone is actually going to. Generating for every game on the schedule would cost
  // real money for storylines nobody opens.
  const hours = Math.min(Math.max(body.upcoming_hours ?? 36, 1), 168);
  const now = new Date();
  const until = new Date(now.getTime() + hours * 3_600_000);
  const { data: going, error: goingError } = await db
    .from('attendances')
    .select('game_id')
    .eq('status', 'going');
  if (goingError) throw new Error(goingError.message);
  const ids = [...new Set((going ?? []).map((r) => (r as { game_id: string }).game_id))];
  if (ids.length === 0) return [];

  const { data, error } = await db
    .from('games')
    .select(GAME_COLUMNS)
    .in('id', ids)
    .eq('status', 'scheduled')
    .gte('scheduled_start', now.toISOString())
    .lte('scheduled_start', until.toISOString())
    .limit(MAX_GAMES);
  if (error) throw new Error(error.message);
  return (data ?? []) as GameRow[];
}

async function processGame(
  db: MinimalDb,
  client: Anthropic,
  game: GameRow,
  log: string[],
): Promise<number> {
  // The shared MinimalDb interface has no .or(), and it is also what the ingest pipeline is typed
  // against, so rather than widen it each either-or below is two plain queries, merged.
  const sides = [game.home_team_id, game.away_team_id];

  // This season's games for either side: records, streaks, venue split, head to head.
  const season = async (column: 'home_team_id' | 'away_team_id') => {
    const { data, error } = await db
      .from('games')
      .select(GAME_COLUMNS)
      .eq('season', game.season)
      .eq('sport_id', game.sport_id)
      .in(column, sides)
      .lt('scheduled_start', game.scheduled_start)
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []) as GameRow[];
  };

  // The last meeting from any earlier season, which the season queries cannot see. One query per
  // home and away arrangement, and the more recent of the two wins.
  const meeting = async (homeId: string, awayId: string) => {
    const { data, error } = await db
      .from('games')
      .select(GAME_COLUMNS)
      .eq('home_team_id', homeId)
      .eq('away_team_id', awayId)
      .eq('status', 'final')
      .lt('season', game.season)
      .order('scheduled_start', { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return (data ?? []) as GameRow[];
  };

  const [asHome, asAway, meetingA, meetingB] = await Promise.all([
    season('home_team_id'),
    season('away_team_id'),
    meeting(game.home_team_id, game.away_team_id),
    meeting(game.away_team_id, game.home_team_id),
  ]);

  // A game between the two sides comes back from both season queries; keep it once.
  const byId = new Map<string, GameRow>();
  for (const g of [...asHome, ...asAway, ...meetingA, ...meetingB]) byId.set(g.id, g);
  const history = [...byId.values()].map(toSchedule);

  const { data: teamData, error: teamError } = await db
    .from('teams')
    .select('id, name, city, nickname')
    .eq('sport_id', game.sport_id)
    .eq('active', true);
  if (teamError) throw new Error(teamError.message);
  const teams = new Map(((teamData ?? []) as TeamRow[]).map((t) => [t.id, t]));
  const home = teams.get(game.home_team_id);
  const away = teams.get(game.away_team_id);
  if (!home || !away) {
    log.push(`${game.id}: a team is missing or inactive, skipped`);
    return 0;
  }

  // The nickname goes through explicitly: nine MLB teams have a city that is not the start of
  // their name (the Mets are in Flushing), and deriving it from the name fails for all of them.
  const asName = (t: TeamRow): TeamName => ({ name: t.name, city: t.city, nickname: t.nickname });
  const league = [...teams.values()].map(asName);
  const pair: [TeamName, TeamName] = [asName(home), asName(away)];
  const schedule = toSchedule(game);

  const rows: {
    game_id: string;
    team_id: string | null;
    text: string;
    source: string;
    facts: unknown;
  }[] = [];

  for (const [team, opponent] of [
    [home, away],
    [away, home],
  ] as const) {
    const facts = teamFacts(
      schedule,
      team.id,
      { team: shortName(team), opponent: shortName(opponent) },
      history,
    );
    if (!hasSomethingToSay(facts)) {
      log.push(`${game.id} ${shortName(team)}: nothing to say yet`);
      continue;
    }
    const text = await generate(
      client,
      teamPrompt(facts),
      facts,
      { teams: pair, league, subject: asName(team) },
      log,
      `${game.id} ${shortName(team)}`,
    );
    if (text) rows.push({ game_id: game.id, team_id: team.id, text, source: 'results', facts });
  }

  const sig = significance(schedule, { home: shortName(home), away: shortName(away) }, history);
  if (sig) {
    const text = await generate(
      client,
      significancePrompt(sig),
      sig,
      { teams: pair, league, subject: null },
      log,
      `${game.id} significance`,
    );
    if (text) rows.push({ game_id: game.id, team_id: null, text, source: 'schedule', facts: sig });
  }

  // Replace rather than add. The unique index would refuse a second row per slot anyway; this
  // makes a refresh an hour before the start (SPEC 6.18) overwrite the morning's version.
  const { error: deleteError } = await db.from('storylines').delete().eq('game_id', game.id);
  if (deleteError) throw new Error(deleteError.message);
  if (rows.length > 0) {
    const { error: insertError } = await db.from('storylines').insert(rows);
    if (insertError) throw new Error(insertError.message);
  }
  return rows.length;
}

Deno.serve(async (req) => {
  if (!authorizeInternal(req)) return json({ error: 'unauthorized' }, 401);

  let body: { game_ids?: string[]; upcoming_hours?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid body' }, 400);
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY is not set' }, 500);

  const db = serviceDb();
  const client = new Anthropic({ apiKey });
  const log: string[] = [];
  const errors: string[] = [];
  let stored = 0;

  const games = await gamesToProcess(db, body);
  for (const game of games) {
    try {
      stored += await processGame(db, client, game, log);
    } catch (e) {
      errors.push(`${game.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return json({ games: games.length, stored, log, errors });
});
