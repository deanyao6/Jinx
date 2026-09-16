/**
 * nflverse -> canonical game detail. Pure: takes the games.csv row and the game's pbp rows,
 * returns a CanonicalGameDetail. No I/O.
 */
import type {
  CanonicalGameDetail,
  GameStatus,
  GameType,
  NflPlay,
  ScoringEvent,
  Side,
} from '../../types.js';
import { easternToUtcIso } from './eastern.js';
import type { NflverseGameRow, NflversePbpRow } from './rows.js';

export const NFL_PROVIDER = 'nflverse';

/** Default kickoff time (Eastern) when games.csv has no gametime (old seasons). */
const DEFAULT_GAMETIME = '13:00';

/** First play at or after 10:00 remaining in Q1 (SPEC 6.5 lock time). */
const Q1_LOCK_SECONDS_REMAINING = 600;

const POSTSEASON_TYPES = new Set(['WC', 'DIV', 'CON', 'SB']);

/** Marker rows that carry no football action; skipped unless they change the score. */
const MARKER_DESC = /^(GAME|END QUARTER|END GAME|Two-Minute Warning|Timeout)/i;

export function mapGameType(gameType: string | null | undefined): GameType {
  if (gameType === 'REG') return 'regular';
  if (gameType != null && POSTSEASON_TYPES.has(gameType)) return 'postseason';
  return 'preseason';
}

function flag(value: number | null | undefined): boolean {
  return value === 1;
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function teamSide(
  team: string | null | undefined,
  homeTeam: string,
  awayTeam: string,
): Side | null {
  if (team == null) return null;
  if (team === homeTeam) return 'home';
  if (team === awayTeam) return 'away';
  return null;
}

function fieldGoalResult(value: string | null | undefined): NflPlay['fieldGoalResult'] {
  if (value === 'made' || value === 'missed' || value === 'blocked') return value;
  return null;
}

function sortKey(row: NflversePbpRow): number {
  return row.order_sequence ?? row.play_id ?? Number.POSITIVE_INFINITY;
}

function isMarkerRow(row: NflversePbpRow): boolean {
  return row.play_type == null && row.desc != null && MARKER_DESC.test(row.desc.trim());
}

/**
 * nflverse lists 2000-2005 primetime kickoffs as "09:00" on a 12-hour clock (they were 9 PM ET);
 * no NFL game kicks off at 9 AM, so treat it as 21:00 (docs/verification.md).
 */
export function normalizeGametime(season: number, gametime: string): string {
  return season <= 2005 && gametime === '09:00' ? '21:00' : gametime;
}

function scheduledStart(game: NflverseGameRow): string {
  const raw =
    game.gametime != null && game.gametime.trim() !== '' ? game.gametime.trim() : DEFAULT_GAMETIME;
  return easternToUtcIso(game.gameday, normalizeGametime(Number(game.season), raw));
}

/**
 * Build the canonical detail for one nflverse game. `plays` may be in any order and may be
 * empty (an unplayed game); the caller is responsible for setting `finalAt`.
 */
export function parseNflGame(game: NflverseGameRow, plays: NflversePbpRow[]): CanonicalGameDetail {
  const homeTeam = game.home_team;
  const awayTeam = game.away_team;
  const homeScore = numberOrNull(game.home_score);
  const awayScore = numberOrNull(game.away_score);
  const isFinal = homeScore != null && awayScore != null;
  const status: GameStatus = isFinal ? 'final' : 'scheduled';

  const sorted = [...plays].sort((a, b) => sortKey(a) - sortKey(b));

  const items: NflPlay[] = [];
  const timeline: ScoringEvent[] = [];
  let runningHome = 0;
  let runningAway = 0;
  let maxQtr: number | null = null;
  let lastQtr = 1;

  for (const row of sorted) {
    const qtr = row.qtr ?? lastQtr;
    lastQtr = qtr;
    maxQtr = maxQtr == null ? qtr : Math.max(maxQtr, qtr);

    const totalHome = row.total_home_score ?? runningHome;
    const totalAway = row.total_away_score ?? runningAway;
    const scoreChanged = totalHome !== runningHome || totalAway !== runningAway;

    if (isMarkerRow(row) && !scoreChanged) continue;

    const posSide = teamSide(row.posteam, homeTeam, awayTeam);
    const description = row.desc ?? '';
    const play: NflPlay = {
      order: sortKey(row),
      playId: row.play_id != null ? String(row.play_id) : String(sortKey(row)),
      qtr,
      clock: row.time ?? null,
      quarterSecondsRemaining: numberOrNull(row.quarter_seconds_remaining),
      gameSecondsRemaining: numberOrNull(row.game_seconds_remaining),
      timeOfDay: row.time_of_day ?? null,
      description,
      isScoringPlay: flag(row.sp) || scoreChanged,
      playType: row.play_type ?? null,
      homeScore: totalHome,
      awayScore: totalAway,
      posSide,
      tdSide: teamSide(row.td_team, homeTeam, awayTeam),
      touchdown: flag(row.touchdown),
      returnTouchdown: flag(row.return_touchdown),
      interception: flag(row.interception),
      fumble: flag(row.fumble),
      safety: flag(row.safety),
      fieldGoalResult: fieldGoalResult(row.field_goal_result),
      kickDistance: numberOrNull(row.kick_distance),
      kickoffAttempt: flag(row.kickoff_attempt),
      puntAttempt: flag(row.punt_attempt),
      extraPointAttempt: flag(row.extra_point_attempt),
      twoPointAttempt: flag(row.two_point_attempt),
    };
    items.push(play);

    if (scoreChanged) {
      const scoringSide: Side = totalHome > runningHome ? 'home' : 'away';
      timeline.push({
        seq: timeline.length + 1,
        occurredAt: play.timeOfDay,
        period: qtr,
        half: null,
        clock: play.clock,
        homeScore: totalHome,
        awayScore: totalAway,
        scoringSide,
        description,
      });
    }
    runningHome = totalHome;
    runningAway = totalAway;
  }

  const firstLockPlay = items.find(
    (p) =>
      p.qtr === 1 &&
      p.quarterSecondsRemaining != null &&
      p.quarterSecondsRemaining <= Q1_LOCK_SECONDS_REMAINING,
  );
  const timestampsReliable =
    firstLockPlay != null &&
    firstLockPlay.timeOfDay != null &&
    timeline.every((event) => event.occurredAt != null);

  return {
    provider: NFL_PROVIDER,
    providerGameId: game.game_id,
    sport: 'nfl',
    season: game.season,
    gameType: mapGameType(game.game_type),
    scheduledStart: scheduledStart(game),
    providerVenueId: game.stadium_id ?? null,
    venueName: game.stadium ?? null,
    homeProviderTeamId: homeTeam,
    awayProviderTeamId: awayTeam,
    status,
    homeScore,
    awayScore,
    isTie: isFinal && homeScore === awayScore,
    doubleheaderNumber: null,
    rescheduledFromProviderGameId: null,
    rescheduledToProviderGameId: null,
    isNeutralSite: game.location === 'Neutral',
    finalAt: null,
    temperatureF: numberOrNull(game.temp),
    durationMinutes: null,
    attendance: null,
    inningsOrPeriods: maxQtr,
    appearances: [],
    timeline,
    timestampsReliable,
    plays: { sport: 'nfl', items },
  };
}
