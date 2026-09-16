/**
 * Writes canonical games and game details through a MinimalDb. Shared by Node and Deno.
 */
import { detectMlbMoments } from '../providers/mlb/moments.js';
import {
  appearanceRows,
  detailGameRow,
  eventRows,
  gameRow,
  playerRows,
  timelineRows,
  type RowContext,
} from '../rows.js';
import type { CanonicalGame, CanonicalGameDetail, GameEvent } from '../types.js';
import { chunk, upsertRows, type MinimalDb, type VenueMaps } from './db.js';

export interface GameWriteContext {
  teamMap: Map<string, string>;
  venueMaps: VenueMaps;
  /** Which provider_ids key to resolve venues by. */
  venueLookup: 'mlb' | 'nflverse';
}

export function resolveVenue(ctx: GameWriteContext): RowContext['resolveVenue'] {
  return (providerVenueId, season) => {
    if (!providerVenueId) return null;
    if (ctx.venueLookup === 'mlb') return ctx.venueMaps.byMlbVenueId.get(providerVenueId) ?? null;
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

export interface DetailWriteResult {
  gameId: string;
  appearances: number;
  timeline: number;
  events: number;
}

/**
 * Writes a game's detail: context columns, players + appearances, scoring timeline, and moments.
 * `detectMoments` defaults to the MLB detectors; NFL callers pass `detectNflMoments`.
 */
export async function upsertGameDetail(
  db: MinimalDb,
  detail: CanonicalGameDetail,
  ctx: GameWriteContext,
  detectMoments: (d: CanonicalGameDetail) => GameEvent[] = detectMlbMoments,
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
  const playerIdByProvider = new Map<string, string>();
  for (const part of chunk([...new Set(detail.appearances.map((a) => a.providerPlayerId))], 500)) {
    const { data, error } = await db
      .from('players')
      .select('id, provider_player_id')
      .eq('provider', detail.provider)
      .in('provider_player_id', part);
    if (error) throw new Error(error.message);
    for (const p of (data ?? []) as { id: string; provider_player_id: string }[])
      playerIdByProvider.set(p.provider_player_id, p.id);
  }

  const appearances = appearanceRows(detail, game.id, ctx.teamMap, playerIdByProvider);
  await db.from('game_appearances').delete().eq('game_id', game.id);
  await upsertRows(db, 'game_appearances', appearances, 'game_id,player_id');

  await db.from('game_scoring_timeline').delete().eq('game_id', game.id);
  await upsertRows(db, 'game_scoring_timeline', timelineRows(detail, game.id), 'game_id,seq');

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
