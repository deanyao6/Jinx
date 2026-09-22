/**
 * NBA feeds -> canonical types. Pure: every function takes parsed JSON and returns domain
 * objects. No I/O. Field names are the ones verified in docs/verification.md ("NBA data
 * sources"); fixtures live in ingest/fixtures/nba.
 *
 * Schedules and finals come from the stats.nba.com game log (one row per team per game, no
 * start time, no venue) joined to ESPN's scoreboard for the month (start time, venue,
 * attendance), and for the current season from the CDN schedule. Detail comes from the CDN
 * boxscore and play-by-play where they exist (2019-20 on) and from stats.nba.com otherwise.
 */
import type {
  Appearance,
  CanonicalGame,
  CanonicalGameDetail,
  GameStatus,
  LiveState,
  NbaBoxLine,
  NbaPlay,
  RosterEntry,
  ScoringEvent,
  Side,
} from '../../types.js';
import { nbaScorer } from '../../scoring.js';
import type {
  CdnAction,
  CdnBoxscore,
  CdnPlayByPlay,
  CdnScheduleGame,
  CdnScoreboardGame,
  EspnEvent,
  StatsAction,
  StatsBoxScore,
  StatsResponse,
} from '../../ingest/nbaClient.js';
import { statsRows } from '../../ingest/nbaClient.js';
import { easternToUtcIso } from '../nfl/eastern.js';
import {
  NBA_PROVIDER,
  clockLabel,
  clockToSeconds,
  easternDateOf,
  gameTypeCode,
  gameTypeFromId,
  nbaProviderTeamId,
  seasonFromGameId,
} from './ids.js';

// ---------------------------------------------------------------------------
// The game log: one row per team per game
// ---------------------------------------------------------------------------

export interface GameLogRow {
  SEASON_ID: string;
  TEAM_ID: number;
  TEAM_ABBREVIATION: string;
  TEAM_NAME: string;
  GAME_ID: string;
  GAME_DATE: string;
  MATCHUP: string;
  WL: string | null;
  PTS: number | null;
}

/** One game as the log states it: both teams, the Eastern date and the final score. */
export interface LogGame {
  gameId: string;
  season: number;
  /** YYYY-MM-DD in the Eastern zone. */
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  /**
   * True when the log printed '@' on both rows, which it does for a neutral-site game (Mexico
   * City, Paris, the Cup semifinals in Las Vegas): home is then the first row and ESPN, which
   * knows the designated home side, settles it in the provider.
   */
  ambiguousHome?: boolean;
}

/**
 * Pairs the log's two rows per game. The row whose MATCHUP contains '@' is the visitor
 * ("LAC @ UTA"); the other is at home ("UTA vs. LAC"). A game with only one row (a team that
 * folded mid-season does not exist since 2000, but a partial page could) is skipped.
 */
export function parseGameLog(response: StatsResponse): LogGame[] {
  const rows = statsRows<GameLogRow>(response);
  const byGame = new Map<string, GameLogRow[]>();
  for (const r of rows) {
    const list = byGame.get(r.GAME_ID) ?? [];
    list.push(r);
    byGame.set(r.GAME_ID, list);
  }
  const out: LogGame[] = [];
  for (const [gameId, pair] of byGame) {
    if (pair.length !== 2) continue;
    let away = pair.find((r) => r.MATCHUP.includes('@'));
    let home = pair.find((r) => !r.MATCHUP.includes('@'));
    const ambiguous = !away || !home;
    if (ambiguous) {
      home = pair[0]!;
      away = pair[1]!;
    }
    const season = seasonFromGameId(gameId);
    if (season == null) continue;
    out.push({
      gameId,
      season,
      date: home!.GAME_DATE.slice(0, 10),
      homeTeamId: String(home!.TEAM_ID),
      awayTeamId: String(away!.TEAM_ID),
      homeName: home!.TEAM_NAME,
      awayName: away!.TEAM_NAME,
      homeScore: typeof home!.PTS === 'number' ? home!.PTS : null,
      awayScore: typeof away!.PTS === 'number' ? away!.PTS : null,
      ...(ambiguous ? { ambiguousHome: true } : {}),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.gameId.localeCompare(b.gameId));
}

// ---------------------------------------------------------------------------
// ESPN's scoreboard: the start time, venue and attendance the log lacks
// ---------------------------------------------------------------------------

export interface EspnGameInfo {
  eventId: string;
  /** ISO UTC. */
  start: string;
  /** YYYY-MM-DD in the Eastern zone, the key the game log is matched on. */
  etDate: string;
  homeNick: string;
  awayNick: string;
  homeScore: number | null;
  awayScore: number | null;
  venueId: string | null;
  venueName: string | null;
  attendance: number | null;
  neutral: boolean;
  final: boolean;
}

/** "Trail Blazers" and "Portland Trail Blazers" both give "blazers": the last word, lower-cased. */
export function nickKey(name: string): string {
  const words = name.trim().split(/\s+/);
  return (words[words.length - 1] ?? '').toLowerCase();
}

export function parseEspnScoreboard(events: readonly EspnEvent[]): EspnGameInfo[] {
  const out: EspnGameInfo[] = [];
  for (const e of events) {
    const c = e.competitions?.[0];
    if (!c) continue;
    const home = c.competitors.find((x) => x.homeAway === 'home');
    const away = c.competitors.find((x) => x.homeAway === 'away');
    if (!home || !away) continue;
    const start = new Date(Date.parse(c.date ?? e.date)).toISOString();
    const score = (s: string | undefined): number | null =>
      s != null && s !== '' && Number.isFinite(Number(s)) ? Number(s) : null;
    out.push({
      eventId: e.id,
      start,
      etDate: easternDateOf(start),
      homeNick: nickKey(home.team.name ?? home.team.displayName),
      awayNick: nickKey(away.team.name ?? away.team.displayName),
      homeScore: score(home.score),
      awayScore: score(away.score),
      venueId: c.venue?.id ?? null,
      venueName: c.venue?.fullName?.trim() ?? null,
      attendance: typeof c.attendance === 'number' ? c.attendance : null,
      neutral: c.neutralSite === true,
      final: c.status?.type?.name === 'STATUS_FINAL' || c.status?.type?.completed === true,
    });
  }
  return out;
}

/** The lookup key for a game: its Eastern date and the two nicknames, home first. */
export function espnKey(etDate: string, homeName: string, awayName: string): string {
  return `${etDate}|${nickKey(homeName)}|${nickKey(awayName)}`;
}

export function indexEspn(infos: readonly EspnGameInfo[]): Map<string, EspnGameInfo> {
  const map = new Map<string, EspnGameInfo>();
  for (const i of infos) map.set(`${i.etDate}|${i.homeNick}|${i.awayNick}`, i);
  return map;
}

/** The default tip-off for a game ESPN does not know: 7:00 PM Eastern on the log's date. */
const DEFAULT_TIP_ET = '19:00';

/**
 * A log game plus what ESPN adds. The venue reference is `espn:<id>`, which the writer resolves
 * through `venues.provider_ids.espn_venue_ids`. A game ESPN has no row for keeps the log's date
 * at a default evening tip and no venue.
 */
export function logGameToCanonical(g: LogGame, espn: EspnGameInfo | undefined): CanonicalGame {
  const finalScore = g.homeScore != null && g.awayScore != null;
  return {
    provider: NBA_PROVIDER,
    providerGameId: g.gameId,
    sport: 'nba',
    season: g.season,
    gameType: gameTypeFromId(g.gameId),
    scheduledStart: espn?.start ?? easternToUtcIso(g.date, DEFAULT_TIP_ET),
    providerVenueId: espn?.venueId ? `espn:${espn.venueId}` : null,
    venueName: espn?.venueName ?? null,
    homeProviderTeamId: nbaProviderTeamId(g.homeTeamId, g.season),
    awayProviderTeamId: nbaProviderTeamId(g.awayTeamId, g.season),
    status: finalScore ? 'final' : 'scheduled',
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    isTie: false,
    doubleheaderNumber: null,
    rescheduledFromProviderGameId: null,
    rescheduledToProviderGameId: null,
    isNeutralSite: espn?.neutral ?? gameTypeCode(g.gameId) === '006',
    finalAt: null,
  };
}

// ---------------------------------------------------------------------------
// The CDN schedule: the current season, with real start times
// ---------------------------------------------------------------------------

function cdnStatus(g: CdnScheduleGame): GameStatus {
  if (g.postponedStatus && g.postponedStatus !== 'N') return 'postponed';
  if (g.gameStatus === 3) return 'final';
  if (g.gameStatus === 2) return 'live';
  return 'scheduled';
}

/** Game types the app stores. The All-Star game (`003`) is left out. */
/**
 * Regular season (002), the Cup final (006), playoffs (004) and the play-in (005). Preseason
 * (001) is not stored: only regular season and postseason games exist in Jinx (Dean,
 * 2026-09-22), and the All-Star game (003) never was.
 */
const STORED_TYPES = new Set(['002', '004', '005', '006']);

/**
 * The CDN schedule as canonical games. The venue reference is `name:<arenaName>`, resolved
 * through venue aliases; a game whose home tricode does not belong to a known team (an
 * exhibition against a non-NBA side) is skipped by the caller through the team map.
 */
export function parseCdnSchedule(games: readonly CdnScheduleGame[]): CanonicalGame[] {
  const out: CanonicalGame[] = [];
  for (const g of games) {
    if (!STORED_TYPES.has(gameTypeCode(g.gameId))) continue;
    const season = seasonFromGameId(g.gameId);
    if (season == null || !g.homeTeam?.teamId || !g.awayTeam?.teamId) continue;
    const status = cdnStatus(g);
    const final = status === 'final';
    out.push({
      provider: NBA_PROVIDER,
      providerGameId: g.gameId,
      sport: 'nba',
      season,
      gameType: gameTypeFromId(g.gameId),
      scheduledStart: new Date(Date.parse(g.gameDateTimeUTC)).toISOString(),
      providerVenueId: g.arenaName ? `name:${g.arenaName}` : null,
      venueName: g.arenaName || null,
      homeProviderTeamId: nbaProviderTeamId(g.homeTeam.teamId, season),
      awayProviderTeamId: nbaProviderTeamId(g.awayTeam.teamId, season),
      status,
      homeScore: final ? g.homeTeam.score : null,
      awayScore: final ? g.awayTeam.score : null,
      isTie: false,
      doubleheaderNumber: null,
      rescheduledFromProviderGameId: null,
      rescheduledToProviderGameId: null,
      isNeutralSite: g.isNeutral === true || gameTypeCode(g.gameId) === '006',
      finalAt: null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Play-by-play, from either feed, to NbaPlay rows
// ---------------------------------------------------------------------------

/** What both feeds have in common, so one walk builds the plays. */
interface RawAction {
  actionNumber: number;
  clock: string;
  timeActual: string | null;
  period: number;
  teamId: string | null;
  actionType: string;
  subType: string | null;
  personId: string | null;
  playerName: string | null;
  scoreHome: string;
  scoreAway: string;
  isFieldGoal: boolean;
  shotResult: string | null;
  description: string;
}

function fromCdn(a: CdnAction): RawAction {
  return {
    actionNumber: a.actionNumber,
    clock: a.clock,
    timeActual: a.timeActual ? new Date(Date.parse(a.timeActual)).toISOString() : null,
    period: a.period,
    teamId: a.teamId ? String(a.teamId) : null,
    actionType: a.actionType,
    subType: a.subType ?? null,
    personId: a.personId ? String(a.personId) : null,
    playerName: a.playerName ?? null,
    scoreHome: a.scoreHome,
    scoreAway: a.scoreAway,
    isFieldGoal: a.isFieldGoal === 1,
    shotResult: a.shotResult ?? null,
    description: a.description ?? '',
  };
}

/** stats.nba.com names its types differently: "Made Shot", "Free Throw", "period". */
function fromStats(a: StatsAction): RawAction {
  const made = a.actionType === 'Made Shot';
  const missed = a.actionType === 'Missed Shot';
  let actionType = a.actionType.toLowerCase();
  if (made || missed) actionType = a.shotValue === 3 ? '3pt' : '2pt';
  else if (a.actionType === 'Free Throw') actionType = 'freethrow';
  const ftMissed = a.actionType === 'Free Throw' && /^MISS\b/i.test(a.description);
  return {
    actionNumber: a.actionNumber,
    clock: a.clock,
    timeActual: null,
    period: a.period,
    teamId: a.teamId ? String(a.teamId) : null,
    actionType,
    subType: a.subType || null,
    personId: a.personId ? String(a.personId) : null,
    playerName: a.playerName || null,
    scoreHome: a.scoreHome,
    scoreAway: a.scoreAway,
    isFieldGoal: a.isFieldGoal === 1,
    shotResult:
      made || (a.actionType === 'Free Throw' && !ftMissed)
        ? 'Made'
        : missed || ftMissed
          ? 'Missed'
          : a.shotResult || null,
    description: a.description ?? '',
  };
}

function freeThrowOf(subType: string | null, description: string): string | null {
  const m = /(\d) of (\d)/.exec(subType ?? '') ?? /(\d) of (\d)/.exec(description);
  if (m) return `${m[1]} of ${m[2]}`;
  if (/technical/i.test(subType ?? '') || /technical/i.test(description)) return 'Technical';
  return null;
}

/**
 * Plays in order, with the running score. The stats feed prints "0" for both scores on a
 * missed free throw and some non-scoring rows, so a row's score is taken only when it does
 * not go backwards; the running score is what every play reports.
 */
export function buildPlays(
  actions: readonly RawAction[],
  homeTeamId: string,
  names: ReadonlyMap<string, string>,
): NbaPlay[] {
  const sorted = [...actions].sort((a, b) => a.actionNumber - b.actionNumber);
  const plays: NbaPlay[] = [];
  let home = 0;
  let away = 0;
  for (const a of sorted) {
    const h = Number(a.scoreHome);
    const aw = Number(a.scoreAway);
    const ok = Number.isFinite(h) && Number.isFinite(aw) && h + aw >= home + away;
    const scored = ok && (h !== home || aw !== away);
    if (ok) {
      home = h;
      away = aw;
    }
    const side: Side | null = a.teamId == null ? null : a.teamId === homeTeamId ? 'home' : 'away';
    const madeShot = a.shotResult === 'Made';
    const isFt = a.actionType === 'freethrow';
    const points = scored
      ? h +
        aw -
        (plays[plays.length - 1]?.homeScore ?? 0) -
        (plays[plays.length - 1]?.awayScore ?? 0)
      : 0;
    plays.push({
      actionNumber: a.actionNumber,
      period: a.period,
      clock: clockLabel(a.clock),
      periodSecondsRemaining: clockToSeconds(a.clock),
      timeActual: a.timeActual,
      actionType: a.actionType,
      subType: a.subType,
      description: a.description,
      homeScore: home,
      awayScore: away,
      isScoringPlay: scored,
      side,
      playerId: a.personId && a.personId !== '0' ? a.personId : null,
      playerName: a.personId && a.personId !== '0' ? (names.get(a.personId) ?? a.playerName) : null,
      points: Math.max(0, points),
      isFieldGoal: a.isFieldGoal,
      shotMade: a.isFieldGoal || isFt ? madeShot : null,
      freeThrowOf: isFt ? freeThrowOf(a.subType, a.description) : null,
    });
  }
  return plays;
}

/** The scoring timeline: one row per score change, with the kind and the scorer. */
export function timelineFromPlays(plays: readonly NbaPlay[]): ScoringEvent[] {
  const out: ScoringEvent[] = [];
  let prevHome = 0;
  let lastBasket: NbaPlay | null = null;
  for (const p of plays) {
    if (!p.isScoringPlay) continue;
    const scoringSide: Side = p.homeScore > prevHome ? 'home' : 'away';
    const scorer = nbaScorer(p, lastBasket);
    out.push({
      seq: out.length + 1,
      occurredAt: p.timeActual,
      period: p.period,
      half: null,
      clock: p.clock,
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      scoringSide,
      description: p.description,
      ...scorer,
    });
    if (p.isFieldGoal) lastBasket = p;
    else if (p.actionType !== 'freethrow') lastBasket = null;
    prevHome = p.homeScore;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Box scores
// ---------------------------------------------------------------------------

/** "PT32M23.00S" or "32:23" to minutes as a decimal. */
export function minutesOf(raw: unknown): number {
  if (typeof raw !== 'string' || !raw) return 0;
  const iso = /^PT(?:(\d+)M)?(?:([\d.]+)S)?$/.exec(raw);
  if (iso) return Number(iso[1] ?? 0) + Number(iso[2] ?? 0) / 60;
  const mmss = /^(\d+):(\d{2})$/.exec(raw);
  if (mmss) return Number(mmss[1]) + Number(mmss[2]) / 60;
  return 0;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0;
}

interface BoxPerson {
  id: string;
  name: string;
  side: Side;
  minutes: number;
  stats: Record<string, number | string>;
  played: boolean;
}

function cdnPeople(box: CdnBoxscore): BoxPerson[] {
  const out: BoxPerson[] = [];
  for (const side of ['home', 'away'] as const) {
    const team = side === 'home' ? box.game.homeTeam : box.game.awayTeam;
    for (const p of team.players ?? []) {
      const stats = p.statistics ?? {};
      const minutes = minutesOf(stats['minutes']);
      out.push({
        id: String(p.personId),
        name: p.name || `${p.firstName ?? ''} ${p.familyName ?? ''}`.trim(),
        side,
        minutes,
        stats,
        played: p.played === '1' || minutes > 0,
      });
    }
  }
  return out;
}

function statsPeople(box: StatsBoxScore): BoxPerson[] {
  const out: BoxPerson[] = [];
  for (const side of ['home', 'away'] as const) {
    const team = side === 'home' ? box.homeTeam : box.awayTeam;
    for (const p of team.players ?? []) {
      const stats = p.statistics ?? {};
      const minutes = minutesOf(stats['minutes']);
      out.push({
        id: String(p.personId),
        name: `${p.firstName ?? ''} ${p.familyName ?? ''}`.trim(),
        side,
        minutes,
        stats,
        played: minutes > 0 || num(stats['points']) > 0 || num(stats['reboundsTotal']) > 0,
      });
    }
  }
  return out;
}

function boxLines(people: readonly BoxPerson[]): NbaBoxLine[] {
  return people
    .filter((p) => p.played)
    .map((p) => ({
      playerId: p.id,
      playerName: p.name,
      side: p.side,
      minutes: Math.round(p.minutes * 10) / 10,
      points: num(p.stats['points']),
      rebounds: num(p.stats['reboundsTotal']),
      assists: num(p.stats['assists']),
      steals: num(p.stats['steals']),
      blocks: num(p.stats['blocks']),
    }));
}

function appearances(
  people: readonly BoxPerson[],
  homeProviderTeamId: string,
  awayProviderTeamId: string,
): Appearance[] {
  return people
    .filter((p) => p.played)
    .map((p) => ({
      providerPlayerId: p.id,
      fullName: p.name,
      providerTeamId: p.side === 'home' ? homeProviderTeamId : awayProviderTeamId,
      line: {
        pts: num(p.stats['points']),
        reb: num(p.stats['reboundsTotal']),
        ast: num(p.stats['assists']),
        stl: num(p.stats['steals']),
        blk: num(p.stats['blocks']),
      },
    }));
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

/** What the caller already knows about the game from the schedule row. */
export interface DetailContext {
  providerGameId: string;
  scheduledStart: string;
  providerVenueId: string | null;
  venueName: string | null;
  isNeutralSite: boolean;
}

/** The end of the first period, if the feed marked it with a wall-clock time. */
function endOfFirstReliable(plays: readonly NbaPlay[]): boolean {
  const end = plays.find(
    (p) => p.period === 1 && p.actionType === 'period' && /end/i.test(p.subType ?? ''),
  );
  return end?.timeActual != null;
}

/**
 * The wall clock of the "Game End" action (actionType game, subType end), which the CDN
 * play-by-play always closes with (docs/verification.md, 2026-09-22); otherwise the last play
 * stamped at all, and null for the stats.nba.com path, which carries no wall clock.
 */
export function nbaGameEndTime(plays: readonly Pick<NbaPlay, 'actionType' | 'subType' | 'timeActual'>[]): string | null {
  return (
    plays.find((a) => a.actionType === 'game' && a.subType === 'end')?.timeActual ??
    [...plays].reverse().find((a) => a.timeActual)?.timeActual ??
    null
  );
}

function assemble(
  ctx: DetailContext,
  season: number,
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number,
  plays: NbaPlay[],
  people: BoxPerson[],
  extra: { attendance: number | null; durationMinutes: number | null; final: boolean },
): CanonicalGameDetail {
  const homeProviderTeamId = nbaProviderTeamId(homeTeamId, season);
  const awayProviderTeamId = nbaProviderTeamId(awayTeamId, season);
  const timeline = timelineFromPlays(plays);
  const periods = plays.reduce((m, p) => Math.max(m, p.period), 0) || null;
  const timestampsReliable =
    plays.length > 0 && endOfFirstReliable(plays) && timeline.every((e) => e.occurredAt != null);
  return {
    provider: NBA_PROVIDER,
    providerGameId: ctx.providerGameId,
    sport: 'nba',
    season,
    gameType: gameTypeFromId(ctx.providerGameId),
    scheduledStart: ctx.scheduledStart,
    providerVenueId: ctx.providerVenueId,
    venueName: ctx.venueName,
    homeProviderTeamId,
    awayProviderTeamId,
    status: extra.final ? 'final' : 'live',
    homeScore,
    awayScore,
    isTie: false,
    doubleheaderNumber: null,
    rescheduledFromProviderGameId: null,
    rescheduledToProviderGameId: null,
    isNeutralSite: ctx.isNeutralSite,
    // The wall clock of the "Game End" action (actionType game, subType end), which the CDN
    // play-by-play always closes with (docs/verification.md, 2026-09-22); the last play stamped
    // at all when a feed lacks it.
    finalAt: extra.final ? nbaGameEndTime(plays) : null,
    temperatureF: null,
    durationMinutes: extra.durationMinutes,
    attendance: extra.attendance,
    inningsOrPeriods: periods,
    appearances: appearances(people, homeProviderTeamId, awayProviderTeamId),
    timeline,
    timestampsReliable,
    plays: { sport: 'nba', items: plays },
    boxLines: boxLines(people),
  };
}

/** Detail from the CDN's two liveData files (2019-20 on; wall-clock times present). */
export function parseCdnDetail(
  box: CdnBoxscore,
  pbp: CdnPlayByPlay,
  ctx: DetailContext,
): CanonicalGameDetail {
  const g = box.game;
  const season = seasonFromGameId(g.gameId) ?? seasonFromGameId(ctx.providerGameId) ?? 0;
  const people = cdnPeople(box);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const plays = buildPlays(pbp.game.actions.map(fromCdn), String(g.homeTeam.teamId), names);
  const attendance = typeof g.attendance === 'number' && g.attendance > 0 ? g.attendance : null;
  return assemble(
    ctx,
    season,
    String(g.homeTeam.teamId),
    String(g.awayTeam.teamId),
    g.homeTeam.score,
    g.awayTeam.score,
    plays,
    people,
    {
      attendance,
      durationMinutes: typeof g.duration === 'number' && g.duration > 0 ? g.duration : null,
      final: g.gameStatus === 3,
    },
  );
}

/** "2:22" from boxscoresummaryv2's GAME_TIME to minutes. */
export function gameTimeMinutes(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const m = /^(\d+):(\d{2})$/.exec(raw.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Detail from stats.nba.com (back to 2000; no wall clock, so pledges stay valid). */
export function parseStatsDetail(
  box: StatsBoxScore,
  pbp: { game: { actions: StatsAction[] } },
  summary: StatsResponse | null,
  ctx: DetailContext,
): CanonicalGameDetail {
  const season = seasonFromGameId(box.gameId) ?? seasonFromGameId(ctx.providerGameId) ?? 0;
  const people = statsPeople(box);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const plays = buildPlays(pbp.game.actions.map(fromStats), String(box.homeTeamId), names);
  const last = plays[plays.length - 1];
  const info = summary
    ? statsRows<{ ATTENDANCE: number; GAME_TIME: string }>(summary, 'GameInfo')[0]
    : undefined;
  const summaryRow = summary
    ? statsRows<{ GAME_STATUS_ID: number }>(summary, 'GameSummary')[0]
    : undefined;
  const lines = summary ? statsRows<{ TEAM_ID: number; PTS: number }>(summary, 'LineScore') : [];
  const lineFor = (teamId: number): number | null =>
    lines.find((l) => l.TEAM_ID === teamId)?.PTS ?? null;
  const homeScore = lineFor(box.homeTeamId) ?? last?.homeScore ?? 0;
  const awayScore = lineFor(box.awayTeamId) ?? last?.awayScore ?? 0;
  return assemble(
    ctx,
    season,
    String(box.homeTeamId),
    String(box.awayTeamId),
    homeScore,
    awayScore,
    plays,
    people,
    {
      attendance: info && num(info.ATTENDANCE) > 0 ? num(info.ATTENDANCE) : null,
      durationMinutes: gameTimeMinutes(info?.GAME_TIME),
      final: summaryRow ? summaryRow.GAME_STATUS_ID === 3 : true,
    },
  );
}

// ---------------------------------------------------------------------------
// Live state and rosters
// ---------------------------------------------------------------------------

/** One game of `todaysScoreboard_00.json` as the pledge countdown reads it. */
export function parseCdnLiveState(g: CdnScoreboardGame, fetchedAt: string): LiveState {
  const status: GameStatus =
    g.gameStatus === 3 ? 'final' : g.gameStatus === 2 ? 'live' : 'scheduled';
  const text = g.gameStatusText ?? '';
  let inningState: LiveState['inningState'] = null;
  if (status === 'final') inningState = 'end';
  else if (status === 'live') {
    if (/half/i.test(text)) inningState = 'halftime';
    else if (/^end/i.test(text)) inningState = 'end';
    else inningState = 'live';
  }
  return {
    status,
    inning: status === 'scheduled' ? null : g.period || null,
    inningState,
    clock: status === 'live' ? clockLabel(g.gameClock) : null,
    homeScore: g.homeTeam?.score ?? 0,
    awayScore: g.awayTeam?.score ?? 0,
    fetchedAt,
  };
}

interface RosterRow {
  PLAYER_ID: number;
  PLAYER: string;
  NUM: string | null;
  POSITION: string | null;
}

/** `commonteamroster`: today's roster, one row per player. */
export function parseNbaRoster(response: StatsResponse): RosterEntry[] {
  const out: RosterEntry[] = [];
  const seen = new Set<string>();
  for (const r of statsRows<RosterRow>(response, 'CommonTeamRoster')) {
    const id = String(r.PLAYER_ID);
    if (!r.PLAYER || seen.has(id)) continue;
    seen.add(id);
    const jersey = (r.NUM ?? '').trim();
    out.push({
      providerPlayerId: id,
      fullName: r.PLAYER,
      position: r.POSITION?.trim() || null,
      jersey: jersey || null,
      status: null,
    });
  }
  return out;
}
