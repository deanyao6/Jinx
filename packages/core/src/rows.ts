/**
 * Pure mapping from canonical types to database rows. Shared by the Node ingest package and the
 * Deno Edge Functions so there is exactly one place that knows the column names.
 */
import { trueLock } from './pledge.js';
import type { CanonicalGame, CanonicalGameDetail, GameEvent, Side } from './types.js';

export interface RowContext {
  /** provider_team_id -> team uuid */
  teamMap: Map<string, string>;
  /** Resolves a provider venue id (+ season) to a venue uuid. */
  resolveVenue: (providerVenueId: string | null, season: number) => string | null;
}

export type GameRow = Record<string, unknown>;

export function gameRow(g: CanonicalGame, ctx: RowContext): GameRow {
  const home = ctx.teamMap.get(g.homeProviderTeamId);
  const away = ctx.teamMap.get(g.awayProviderTeamId);
  if (!home || !away) {
    throw new Error(
      `unknown team for game ${g.provider}:${g.providerGameId} (${g.homeProviderTeamId} vs ${g.awayProviderTeamId})`,
    );
  }
  const winner =
    g.status === 'final' &&
    g.homeScore !== null &&
    g.awayScore !== null &&
    g.homeScore !== g.awayScore
      ? g.homeScore > g.awayScore
        ? home
        : away
      : null;
  return {
    sport_id: g.sport,
    season: g.season,
    game_type: g.gameType,
    scheduled_start: g.scheduledStart,
    venue_id: ctx.resolveVenue(g.providerVenueId, g.season),
    home_team_id: home,
    away_team_id: away,
    status: g.status,
    home_score: g.homeScore,
    away_score: g.awayScore,
    winner_team_id: winner,
    is_tie: g.isTie,
    doubleheader_number: g.doubleheaderNumber,
    is_neutral_site: g.isNeutralSite,
    provider: g.provider,
    provider_game_id: g.providerGameId,
    final_at: g.finalAt,
  };
}

export function detailGameRow(d: CanonicalGameDetail, ctx: RowContext, now: string): GameRow {
  const lock = trueLock(d);
  return {
    ...gameRow(d, ctx),
    pledge_lock_at: lock.at,
    pledge_lock_reliable: lock.reliable,
    temperature_f: d.temperatureF,
    duration_minutes: d.durationMinutes,
    attendance: d.attendance,
    innings_or_periods: d.inningsOrPeriods,
    timestamps_reliable: d.timestampsReliable,
    detail_ingested_at: now,
  };
}

export function playerRows(d: CanonicalGameDetail): GameRow[] {
  const seen = new Set<string>();
  const out: GameRow[] = [];
  for (const a of d.appearances) {
    if (seen.has(a.providerPlayerId)) continue;
    seen.add(a.providerPlayerId);
    out.push({
      sport_id: d.sport,
      full_name: a.fullName,
      provider: d.provider,
      provider_player_id: a.providerPlayerId,
    });
  }
  return out;
}

export function appearanceRows(
  d: CanonicalGameDetail,
  gameId: string,
  teamMap: Map<string, string>,
  playerIdByProvider: Map<string, string>,
): GameRow[] {
  const seen = new Set<string>();
  const out: GameRow[] = [];
  for (const a of d.appearances) {
    const player_id = playerIdByProvider.get(a.providerPlayerId);
    const team_id = teamMap.get(a.providerTeamId);
    if (!player_id || !team_id || seen.has(player_id)) continue;
    seen.add(player_id);
    out.push({ game_id: gameId, player_id, team_id });
  }
  return out;
}

export function timelineRows(d: CanonicalGameDetail, gameId: string): GameRow[] {
  return d.timeline.map((e) => ({
    game_id: gameId,
    seq: e.seq,
    occurred_at: e.occurredAt,
    period: e.period,
    half: e.half,
    clock: e.clock,
    home_score: e.homeScore,
    away_score: e.awayScore,
    scoring_side: e.scoringSide,
    description: e.description,
  }));
}

export function eventRows(
  events: GameEvent[],
  gameId: string,
  sides: { home: string; away: string },
  playerIdByProvider: Map<string, string>,
): GameRow[] {
  const sideTeam = (side: Side | null): string | null =>
    side === 'home' ? sides.home : side === 'away' ? sides.away : null;
  return events.map((e) => ({
    game_id: gameId,
    type: e.type,
    player_id: e.providerPlayerId ? (playerIdByProvider.get(e.providerPlayerId) ?? null) : null,
    team_id: sideTeam(e.side),
    occurred_at: e.occurredAt,
    detail: { ...e.detail, playerName: e.playerName, side: e.side },
  }));
}
