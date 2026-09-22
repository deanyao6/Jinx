/**
 * Writes canonical games and game details through a MinimalDb. Shared by Node and Deno.
 */
import { detectMlbMoments } from '../providers/mlb/moments.js';
import { detectNbaMoments } from '../providers/nba/moments.js';
import { detectNflMoments } from '../providers/nfl/moments.js';
import {
  appearanceRows,
  detailGameRow,
  eventRows,
  gameRow,
  playerRows,
  timelineRows,
  timelineScorerIds,
  type PlayerRef,
  type RowContext,
} from '../rows.js';
import type { CanonicalGame, CanonicalGameDetail, GameEvent } from '../types.js';
import { chunk, upsertRows, type MinimalDb, type VenueMaps } from './db.js';

export interface GameWriteContext {
  teamMap: Map<string, string>;
  venueMaps: VenueMaps;
  /** Which provider_ids key to resolve venues by. */
  venueLookup: 'mlb' | 'nflverse' | 'nba' | 'mls';
}

export function resolveVenue(ctx: GameWriteContext): RowContext['resolveVenue'] {
  return (providerVenueId, season) => {
    if (!providerVenueId) return null;
    if (ctx.venueLookup === 'mlb') return ctx.venueMaps.byMlbVenueId.get(providerVenueId) ?? null;
    if (ctx.venueLookup === 'nba' || ctx.venueLookup === 'mls') {
      // The NBA parser tags what it has: an ESPN venue id for history, the CDN's arena name
      // for the current season (resolved through venue aliases, so a renamed arena still
      // lands), or a venue row's own id when the caller already knew it.
      if (providerVenueId.startsWith('espn:'))
        return ctx.venueMaps.byEspnVenueId.get(providerVenueId.slice(5)) ?? null;
      if (providerVenueId.startsWith('name:'))
        return ctx.venueMaps.byAlias.get(providerVenueId.slice(5).trim().toLowerCase()) ?? null;
      if (providerVenueId.startsWith('venue:')) return providerVenueId.slice(6);
      return ctx.venueMaps.byAlias.get(providerVenueId.trim().toLowerCase()) ?? null;
    }
    // nflverse reuses BUF00 for the new Buffalo stadium from 2026 (docs/verification.md).
    if (providerVenueId === 'BUF00' && season >= 2026) {
      return (
        ctx.venueMaps.byKey.get('highmark-stadium') ??
        ctx.venueMaps.byNflverseStadiumId.get(providerVenueId) ??
        null
      );
    }
    return ctx.venueMaps.byNflverseStadiumId.get(providerVenueId) ?? null;
  };
}

function rowCtx(ctx: GameWriteContext): RowContext {
  return { teamMap: ctx.teamMap, resolveVenue: resolveVenue(ctx) };
}

async function lookupIds(
  db: MinimalDb,
  provider: string,
  providerGameIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const part of chunk(providerGameIds, 500)) {
    const { data, error } = await db
      .from('games')
      .select('id, provider_game_id')
      .eq('provider', provider)
      .in('provider_game_id', part);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as { id: string; provider_game_id: string }[])
      out.set(r.provider_game_id, r.id);
  }
  return out;
}

/** Upserts games and then resolves postponed <-> makeup links in a second pass. */
export async function upsertGames(
  db: MinimalDb,
  games: CanonicalGame[],
  ctx: GameWriteContext,
): Promise<void> {
  if (games.length === 0) return;
  const rc = rowCtx(ctx);
  // A season schedule can list the same game twice (suspended games appear on the original and the
  // resume date). Keep the last occurrence so the completed state wins.
  const byId = new Map<string, CanonicalGame>();
  for (const g of games) byId.set(g.providerGameId, g);
  games = [...byId.values()];
  await upsertRows(
    db,
    'games',
    games.map((g) => gameRow(g, rc)),
    'provider,provider_game_id',
  );

  const links = games.filter(
    (g) => g.rescheduledFromProviderGameId || g.rescheduledToProviderGameId,
  );
  if (links.length === 0) return;
  const ids = new Set<string>();
  for (const g of links) {
    ids.add(g.providerGameId);
    if (g.rescheduledFromProviderGameId) ids.add(g.rescheduledFromProviderGameId);
    if (g.rescheduledToProviderGameId) ids.add(g.rescheduledToProviderGameId);
  }
  const uuid = await lookupIds(db, links[0]!.provider, [...ids]);
  for (const g of links) {
    const id = uuid.get(g.providerGameId);
    if (!id) continue;
    const fromId = g.rescheduledFromProviderGameId
      ? uuid.get(g.rescheduledFromProviderGameId)
      : undefined;
    const toId = g.rescheduledToProviderGameId
      ? uuid.get(g.rescheduledToProviderGameId)
      : undefined;
    if (fromId) {
      await db.from('games').update({ rescheduled_from_game_id: fromId }).eq('id', id);
      await db.from('games').update({ rescheduled_to_game_id: id }).eq('id', fromId);
    }
    if (toId) {
      await db.from('games').update({ rescheduled_to_game_id: toId }).eq('id', id);
      await db.from('games').update({ rescheduled_from_game_id: id }).eq('id', toId);
    }
  }
}

/** `players` rows for these provider ids, keyed by provider id. Missing ids are simply absent. */
export async function lookupPlayers(
  db: MinimalDb,
  provider: string,
  providerPlayerIds: readonly string[],
): Promise<Map<string, PlayerRef>> {
  const out = new Map<string, PlayerRef>();
  for (const part of chunk([...new Set(providerPlayerIds)], 500)) {
    const { data, error } = await db
      .from('players')
      .select('id, provider_player_id, full_name')
      .eq('provider', provider)
      .in('provider_player_id', part);
    if (error) throw new Error(error.message);
    for (const p of (data ?? []) as { id: string; provider_player_id: string; full_name: string }[])
      out.set(p.provider_player_id, { id: p.id, fullName: p.full_name });
  }
  return out;
}

/** Replaces a game's scoring timeline. Rows carry the kind and the scorer (`scoring.ts`). */
export async function writeTimeline(
  db: MinimalDb,
  detail: CanonicalGameDetail,
  gameId: string,
  players?: ReadonlyMap<string, PlayerRef>,
): Promise<number> {
  const known = players ?? (await lookupPlayers(db, detail.provider, timelineScorerIds(detail)));
  const { error } = await db.from('game_scoring_timeline').delete().eq('game_id', gameId);
  if (error) throw new Error(`game_scoring_timeline: ${error.message}`);
  const rows = timelineRows(detail, gameId, known);
  await upsertRows(db, 'game_scoring_timeline', rows, 'game_id,seq');
  return rows.length;
}

export interface DetailWriteResult {
  gameId: string;
  appearances: number;
  timeline: number;
  events: number;
}

/** The moment detectors, by the sport the plays belong to. */
export const MOMENT_DETECTORS: Record<
  'mlb' | 'nfl' | 'nba',
  (d: CanonicalGameDetail) => GameEvent[]
> = {
  mlb: detectMlbMoments,
  nfl: detectNflMoments,
  nba: detectNbaMoments,
};

/**
 * Writes a game's detail: context columns, players + appearances, scoring timeline, and moments.
 * `detectMoments` defaults to the detectors for the sport of the plays.
 */
export async function upsertGameDetail(
  db: MinimalDb,
  detail: CanonicalGameDetail,
  ctx: GameWriteContext,
  detectMoments: (d: CanonicalGameDetail) => GameEvent[] = MOMENT_DETECTORS[detail.plays.sport],
): Promise<DetailWriteResult> {
  const rc = rowCtx(ctx);
  await upsertRows(
    db,
    'games',
    [detailGameRow(detail, rc, new Date().toISOString())],
    'provider,provider_game_id',
  );
  const { data: gameData, error: gameErr } = await db
    .from('games')
    .select('id, home_team_id, away_team_id')
    .eq('provider', detail.provider)
    .eq('provider_game_id', detail.providerGameId)
    .single();
  if (gameErr || !gameData) throw new Error(`game lookup failed: ${gameErr?.message ?? 'missing'}`);
  const game = gameData as { id: string; home_team_id: string; away_team_id: string };

  await upsertRows(db, 'players', playerRows(detail), 'provider,provider_player_id');
  // Scorers are looked up with the lineup: a touchdown scorer without a snap count, which the
  // older stats-based seasons can produce, keeps the provider's name and no player id.
  const players = await lookupPlayers(db, detail.provider, [
    ...detail.appearances.map((a) => a.providerPlayerId),
    ...timelineScorerIds(detail),
  ]);
  const playerIdByProvider = new Map<string, string>();
  for (const [providerId, p] of players) playerIdByProvider.set(providerId, p.id);

  const appearances = appearanceRows(detail, game.id, ctx.teamMap, playerIdByProvider);
  await db.from('game_appearances').delete().eq('game_id', game.id);
  await upsertRows(db, 'game_appearances', appearances, 'game_id,player_id');

  await writeTimeline(db, detail, game.id, players);

  const events = eventRows(
    detectMoments(detail),
    game.id,
    { home: game.home_team_id, away: game.away_team_id },
    playerIdByProvider,
  );
  await db.from('game_events').delete().eq('game_id', game.id);
  if (events.length > 0) {
    const { error } = await db.from('game_events').insert(events);
    if (error) throw new Error(`game_events: ${error.message}`);
  }

  // Post-final processing (SPEC 4.5): flips "going" attendances, validates pledges, refreshes stats,
  // evaluates goals. The function exists once the user-data migrations are applied; tolerate its absence.
  if (detail.status === 'final') {
    const { error: rpcErr } = await db.rpc('process_game_final', { p_game_id: game.id });
    if (rpcErr && !rpcErr.message.includes('does not exist')) {
      throw new Error(`process_game_final: ${rpcErr.message}`);
    }
  }

  return {
    gameId: game.id,
    appearances: appearances.length,
    timeline: detail.timeline.length,
    events: events.length,
  };
}
