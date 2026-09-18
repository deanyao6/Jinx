/**
 * Rate-limited HTTP client for the three NBA sources (docs/verification.md, "NBA data
 * sources"). Never call this from the app; ingestion only.
 *
 *   stats.nba.com   the game log per season, box scores and play-by-play back to 2000, rosters
 *   cdn.nba.com     the current season's schedule, live boxscore and play-by-play files for
 *                   2019-20 on, today's scoreboard
 *   ESPN            scoreboards by month (start times, venues, attendance for every season)
 *                   and per-game summaries with win probability (2017-18 on)
 *
 * The NBA hosts answer Node's `fetch` with the plain header set nba.com's own pages send and
 * refuse curl; nothing is impersonated and no token is involved. Every response can be cached
 * by the caller through `cache` (the ingest scripts keep one on disk under `ingest/.cache/nba`)
 * so a backfill never fetches the same season twice.
 */

export interface StatsResultSet {
  name: string;
  headers: string[];
  rowSet: unknown[][];
}
export interface StatsResponse {
  resultSets: StatsResultSet[];
}

export interface CdnScheduleTeam {
  teamId: number;
  teamName: string;
  teamCity: string;
  teamTricode: string;
  score: number;
}
export interface CdnScheduleGame {
  gameId: string;
  gameStatus: number;
  gameStatusText: string;
  gameDateTimeUTC: string;
  gameLabel: string;
  gameSubLabel: string;
  arenaName: string;
  arenaCity: string;
  arenaState: string;
  postponedStatus: string;
  isNeutral: boolean;
  homeTeam: CdnScheduleTeam;
  awayTeam: CdnScheduleTeam;
}
export interface CdnSchedule {
  leagueSchedule: {
    seasonYear: string;
    gameDates: { gameDate: string; games: CdnScheduleGame[] }[];
  };
}

export interface CdnBoxPlayer {
  status: string;
  personId: number;
  name: string;
  firstName?: string;
  familyName?: string;
  jerseyNum?: string;
  position?: string;
  starter?: string;
  played?: string;
  statistics?: Record<string, number | string>;
}
export interface CdnBoxTeam {
  teamId: number;
  teamName: string;
  teamCity: string;
  teamTricode: string;
  score: number;
  periods?: { period: number; periodType: string; score: number }[];
  players: CdnBoxPlayer[];
}
export interface CdnBoxscore {
  game: {
    gameId: string;
    gameTimeUTC: string;
    gameStatus: number;
    gameStatusText: string;
    period: number;
    gameClock: string;
    duration?: number;
    attendance?: number;
    arena?: { arenaId?: number; arenaName?: string; arenaCity?: string; arenaState?: string };
    homeTeam: CdnBoxTeam;
    awayTeam: CdnBoxTeam;
  };
}

export interface CdnAction {
  actionNumber: number;
  clock: string;
  timeActual?: string;
  period: number;
  periodType?: string;
  teamId?: number;
  teamTricode?: string;
  actionType: string;
  subType?: string;
  descriptor?: string;
  qualifiers?: string[];
  personId?: number;
  playerName?: string;
  playerNameI?: string;
  scoreHome: string;
  scoreAway: string;
  isFieldGoal?: number;
  shotResult?: string;
  pointsTotal?: number;
  description?: string;
}
export interface CdnPlayByPlay {
  game: { gameId: string; actions: CdnAction[] };
}

export interface CdnScoreboardGame {
  gameId: string;
  gameStatus: number;
  gameStatusText: string;
  period: number;
  gameClock: string;
  gameTimeUTC: string;
  homeTeam: { teamId: number; teamTricode: string; score: number };
  awayTeam: { teamId: number; teamTricode: string; score: number };
}
export interface CdnScoreboard {
  scoreboard: { gameDate: string; games: CdnScoreboardGame[] };
}

export interface EspnCompetitor {
  id: string;
  homeAway: 'home' | 'away';
  score?: string;
  team: { id: string; abbreviation: string; displayName: string; location?: string; name?: string };
}
export interface EspnEvent {
  id: string;
  date: string;
  name: string;
  season?: { year: number; type: number; slug?: string };
  competitions: {
    id: string;
    date: string;
    neutralSite?: boolean;
    attendance?: number;
    venue?: { id: string; fullName: string; address?: { city?: string; state?: string } };
    status?: { type?: { name?: string; completed?: boolean } };
    competitors: EspnCompetitor[];
  }[];
}
export interface EspnScoreboard {
  events: EspnEvent[];
}

export interface EspnPlay {
  id: string;
  sequenceNumber?: string;
  type?: { id?: string; text?: string };
  text?: string;
  awayScore?: number;
  homeScore?: number;
  period?: { number?: number };
  clock?: { displayValue?: string };
  scoringPlay?: boolean;
  scoreValue?: number;
  team?: { id?: string };
  wallclock?: string;
}
export interface EspnSummary {
  header?: {
    competitions?: {
      date?: string;
      competitors?: EspnCompetitor[];
      status?: { type?: { name?: string } };
    }[];
  };
  gameInfo?: { attendance?: number; venue?: { id?: string; fullName?: string } };
  plays?: EspnPlay[];
  winprobability?: { homeWinPercentage: number; playId: string }[];
}

/** A key-value store the caller can hand in; the ingest scripts back it with files. */
export interface ResponseCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export class NbaHttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`NBA ${status} for ${url}`);
  }
}

export interface NbaClientOptions {
  fetchImpl?: typeof fetch;
  cache?: ResponseCache;
  /** Minimum milliseconds between requests to nba.com hosts (default 1000) and to ESPN (default 300). */
  nbaIntervalMs?: number;
  espnIntervalMs?: number;
}

const BROWSER_HEADERS: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  accept: 'application/json, text/plain, */*',
  referer: 'https://www.nba.com/',
  origin: 'https://www.nba.com',
};
const STATS_HEADERS: Record<string, string> = {
  ...BROWSER_HEADERS,
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
};

export const STATS_BASE = 'https://stats.nba.com/stats/';
export const CDN_BASE = 'https://cdn.nba.com/static/json/';
export const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/';

export class NbaClient {
  private readonly fetchImpl: typeof fetch;
  private readonly cache: ResponseCache | null;
  private readonly nbaInterval: number;
  private readonly espnInterval: number;
  private lastNbaAt = 0;
  private lastEspnAt = 0;

  constructor(opts: NbaClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.cache = opts.cache ?? null;
    this.nbaInterval = opts.nbaIntervalMs ?? 1000;
    this.espnInterval = opts.espnIntervalMs ?? 300;
  }

  private async throttle(host: 'nba' | 'espn'): Promise<void> {
    const last = host === 'nba' ? this.lastNbaAt : this.lastEspnAt;
    const interval = host === 'nba' ? this.nbaInterval : this.espnInterval;
    const wait = last + interval - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (host === 'nba') this.lastNbaAt = Date.now();
    else this.lastEspnAt = Date.now();
  }

  /**
   * One GET, throttled per host, retried with backoff on 429 and 5xx, cached under `cacheKey`
   * when a cache is attached and the caller passes a key. A 4xx other than 429 throws an
   * NbaHttpError the provider can read the status of (the CDN answers 403 for old games).
   */
  async getJson<T>(
    url: string,
    opts: { headers?: Record<string, string>; host: 'nba' | 'espn'; cacheKey?: string },
    attempt = 0,
  ): Promise<T> {
    if (this.cache && opts.cacheKey) {
      const hit = await this.cache.get(opts.cacheKey);
      if (hit) return JSON.parse(hit) as T;
    }
    await this.throttle(opts.host);
    const res = await this.fetchImpl(url, { headers: opts.headers ?? BROWSER_HEADERS });
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 4) throw new NbaHttpError(res.status, url);
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      return this.getJson<T>(url, opts, attempt + 1);
    }
    if (!res.ok) throw new NbaHttpError(res.status, url);
    const text = await res.text();
    const parsed = JSON.parse(text) as T;
    if (this.cache && opts.cacheKey) await this.cache.set(opts.cacheKey, text);
    return parsed;
  }

  // -------------------------------------------------------------------------
  // stats.nba.com
  // -------------------------------------------------------------------------

  /** One row per team per game for a season and SeasonType (`SEASON_TYPES` in providers/nba/ids). */
  leagueGameLog(season: string, seasonType: string, opts: { cache?: boolean } = {}): Promise<StatsResponse> {
    const url = `${STATS_BASE}leaguegamelog?Counter=0&Direction=ASC&LeagueID=00&PlayerOrTeam=T&Season=${season}&SeasonType=${encodeURIComponent(seasonType)}&Sorter=DATE`;
    const key = opts.cache === false ? undefined : `stats_leaguegamelog_${season}_${seasonType.replace(/\W+/g, '_')}`;
    return this.getJson(url, { headers: STATS_HEADERS, host: 'nba', ...(key ? { cacheKey: key } : {}) });
  }

  /** Attendance, game time and the line score for any game since 2000. */
  boxScoreSummary(gameId: string): Promise<StatsResponse> {
    return this.getJson(`${STATS_BASE}boxscoresummaryv2?GameID=${gameId}`, {
      headers: STATS_HEADERS,
      host: 'nba',
      cacheKey: `stats_boxscoresummaryv2_${gameId}`,
    });
  }

  statsBoxScore(gameId: string): Promise<{ boxScoreTraditional: StatsBoxScore }> {
    return this.getJson(
      `${STATS_BASE}boxscoretraditionalv3?GameID=${gameId}&StartPeriod=0&EndPeriod=14&StartRange=0&EndRange=0&RangeType=0`,
      { headers: STATS_HEADERS, host: 'nba', cacheKey: `stats_boxscoretraditionalv3_${gameId}` },
    );
  }

  statsPlayByPlay(gameId: string): Promise<{ game: { gameId: string; actions: StatsAction[] } }> {
    return this.getJson(`${STATS_BASE}playbyplayv3?GameID=${gameId}&StartPeriod=0&EndPeriod=14`, {
      headers: STATS_HEADERS,
      host: 'nba',
      cacheKey: `stats_playbyplayv3_${gameId}`,
    });
  }

  /** Today's roster for a team and season string ('2025-26'). Never cached: it changes daily. */
  commonTeamRoster(teamId: string | number, season: string): Promise<StatsResponse> {
    return this.getJson(`${STATS_BASE}commonteamroster?TeamID=${teamId}&Season=${season}`, {
      headers: STATS_HEADERS,
      host: 'nba',
    });
  }

  // -------------------------------------------------------------------------
  // cdn.nba.com
  // -------------------------------------------------------------------------

  /** The current season's schedule, 4.7 MB. Never cached: it is the source of today's times. */
  cdnSchedule(): Promise<CdnSchedule> {
    return this.getJson(`${CDN_BASE}staticData/scheduleLeagueV2_1.json`, { host: 'nba' });
  }

  cdnBoxScore(gameId: string): Promise<CdnBoxscore> {
    return this.getJson(`${CDN_BASE}liveData/boxscore/boxscore_${gameId}.json`, {
      host: 'nba',
      cacheKey: `cdn_boxscore_${gameId}`,
    });
  }

  cdnPlayByPlay(gameId: string): Promise<CdnPlayByPlay> {
    return this.getJson(`${CDN_BASE}liveData/playbyplay/playbyplay_${gameId}.json`, {
      host: 'nba',
      cacheKey: `cdn_playbyplay_${gameId}`,
    });
  }

  /** Today's games with period, clock and score. Never cached. */
  cdnScoreboard(): Promise<CdnScoreboard> {
    return this.getJson(`${CDN_BASE}liveData/scoreboard/todaysScoreboard_00.json`, { host: 'nba' });
  }

  // -------------------------------------------------------------------------
  // ESPN
  // -------------------------------------------------------------------------

  /** Every game in a month (`YYYYMM`), with start time, venue, attendance and scores. */
  espnScoreboardMonth(yyyymm: string, opts: { cache?: boolean } = {}): Promise<EspnScoreboard> {
    const key = opts.cache === false ? undefined : `espn_scoreboard_${yyyymm}`;
    return this.getJson(`${ESPN_BASE}scoreboard?dates=${yyyymm}&limit=1000`, {
      headers: {},
      host: 'espn',
      ...(key ? { cacheKey: key } : {}),
    });
  }

  espnScoreboardDate(yyyymmdd: string): Promise<EspnScoreboard> {
    return this.getJson(`${ESPN_BASE}scoreboard?dates=${yyyymmdd}`, { headers: {}, host: 'espn' });
  }

  espnSummary(eventId: string): Promise<EspnSummary> {
    return this.getJson(`${ESPN_BASE}summary?event=${eventId}`, {
      headers: {},
      host: 'espn',
      cacheKey: `espn_summary_${eventId}`,
    });
  }
}

export interface StatsBoxPlayer {
  personId: number;
  firstName: string;
  familyName: string;
  nameI?: string;
  position?: string;
  jerseyNum?: string;
  comment?: string;
  statistics?: Record<string, number | string>;
}
export interface StatsBoxTeam {
  teamId: number;
  teamCity: string;
  teamName: string;
  teamTricode: string;
  players: StatsBoxPlayer[];
}
export interface StatsBoxScore {
  gameId: string;
  awayTeamId: number;
  homeTeamId: number;
  homeTeam: StatsBoxTeam;
  awayTeam: StatsBoxTeam;
}
export interface StatsAction {
  actionNumber: number;
  clock: string;
  period: number;
  teamId: number;
  teamTricode: string;
  personId: number;
  playerName: string;
  playerNameI?: string;
  shotResult: string;
  isFieldGoal: number;
  scoreHome: string;
  scoreAway: string;
  pointsTotal?: number;
  description: string;
  actionType: string;
  subType: string;
  shotValue?: number;
}

/** Turns a stats.nba.com result set into objects keyed by its headers. */
export function statsRows<T = Record<string, unknown>>(
  response: StatsResponse,
  name?: string,
): T[] {
  const set = name ? response.resultSets.find((s) => s.name === name) : response.resultSets[0];
  if (!set) return [];
  return set.rowSet.map((row) => {
    const o: Record<string, unknown> = {};
    set.headers.forEach((h, i) => (o[h] = row[i]));
    return o as T;
  });
}
