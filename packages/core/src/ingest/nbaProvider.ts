/**
 * SportsDataProvider for the NBA (SPEC.md 4.4; docs/verification.md "NBA data sources").
 *
 * Schedules and finals for a past season come from the stats.nba.com game log joined to
 * ESPN's monthly scoreboards; the current season comes from the CDN schedule, which has real
 * tip-off times and arenas. Detail tries the CDN's liveData files first (2019-20 on, with
 * wall-clock times) and falls back to stats.nba.com, which reaches back to 2000.
 */
import { NBA_TEAM_ERAS, SEASON_TYPES, seasonForDate, seasonString } from '../providers/nba/ids.js';
import {
  indexEspn,
  logGameToCanonical,
  parseCdnDetail,
  parseCdnLiveState,
  parseCdnSchedule,
  parseEspnScoreboard,
  parseGameLog,
  parseNbaRoster,
  parseStatsDetail,
  espnKey,
  type DetailContext,
  type EspnGameInfo,
  type LogGame,
} from '../providers/nba/parse.js';
import type {
  CanonicalGame,
  CanonicalGameDetail,
  CanonicalTeam,
  DateRange,
  LiveState,
  RosterEntry,
  SportsDataProvider,
} from '../types.js';
import { NbaClient, NbaHttpError, type CdnSchedule } from './nbaClient.js';

/** The months ESPN is asked for a season: September through the following September. */
export function seasonMonths(season: number): string[] {
  const out: string[] = [];
  for (let m = 9; m <= 12; m++) out.push(`${season}${String(m).padStart(2, '0')}`);
  for (let m = 1; m <= 9; m++) out.push(`${season + 1}${String(m).padStart(2, '0')}`);
  return out;
}

export class NbaProvider implements SportsDataProvider {
  readonly sport = 'nba' as const;
  private cdnSchedule: CdnSchedule | null = null;

  constructor(readonly client: NbaClient = new NbaClient()) {}

  private async schedule(): Promise<CdnSchedule> {
    if (!this.cdnSchedule) this.cdnSchedule = await this.client.cdnSchedule();
    return this.cdnSchedule;
  }

  /** The season the CDN schedule currently describes, as a start year. */
  async currentSeason(): Promise<number> {
    const doc = await this.schedule();
    return Number(doc.leagueSchedule.seasonYear.slice(0, 4));
  }

  /** The thirty current teams, as the CDN schedule names them. Historical identities are seeded. */
  async fetchTeams(): Promise<CanonicalTeam[]> {
    const doc = await this.schedule();
    const seen = new Map<string, CanonicalTeam>();
    for (const date of doc.leagueSchedule.gameDates) {
      for (const g of date.games) {
        for (const t of [g.homeTeam, g.awayTeam]) {
          if (!t.teamId || seen.has(String(t.teamId))) continue;
          if (!NBA_TEAM_ERAS.some((e) => e.teamId === String(t.teamId)) && !/^16106127\d\d$/.test(String(t.teamId))) continue;
          seen.set(String(t.teamId), {
            provider: 'nba',
            providerTeamId: String(t.teamId),
            franchiseId: `nba-${t.teamId}`,
            sport: 'nba',
            name: `${t.teamCity} ${t.teamName}`,
            city: t.teamCity,
            abbreviation: t.teamTricode,
            active: true,
            aliases: [t.teamTricode, t.teamName],
          });
        }
      }
    }
    return [...seen.values()];
  }

  /** ESPN's rows for a season, indexed by Eastern date and nicknames. */
  async espnIndex(season: number): Promise<Map<string, EspnGameInfo>> {
    const infos: EspnGameInfo[] = [];
    const now = new Date().toISOString().slice(0, 7).replace('-', '');
    for (const ym of seasonMonths(season)) {
      if (ym > now) break;
      // The current month changes daily; everything earlier is fixed and cached.
      const doc = await this.client.espnScoreboardMonth(ym, { cache: ym < now });
      infos.push(...parseEspnScoreboard(doc.events ?? []));
    }
    return indexEspn(infos);
  }

  /** The game log's rows for every stored season type. The `IST` set only contributes the final. */
  async logGames(season: number): Promise<LogGame[]> {
    const s = seasonString(season);
    const out: LogGame[] = [];
    const current = season >= (await this.currentSeason()) - 1;
    for (const type of [SEASON_TYPES.preseason, SEASON_TYPES.regular, SEASON_TYPES.playIn, SEASON_TYPES.playoffs, SEASON_TYPES.cup]) {
      let doc;
      try {
        // A season still being played changes daily and is not cached.
        doc = await this.client.leagueGameLog(s, type, { cache: !current });
      } catch (err) {
        if (err instanceof NbaHttpError && err.status === 400) continue;
        throw err;
      }
      const games = parseGameLog(doc);
      out.push(...(type === SEASON_TYPES.cup ? games.filter((g) => g.gameId.startsWith('006')) : games));
    }
    const byId = new Map<string, LogGame>();
    for (const g of out) byId.set(g.gameId, g);
    return [...byId.values()];
  }

  /**
   * Every game of a season. For the season the CDN describes, the CDN schedule (future games
   * included, with real tip-off times); for any other, the game log joined to ESPN.
   */
  async fetchSeason(season: number): Promise<CanonicalGame[]> {
    if (season === (await this.currentSeason())) {
      const doc = await this.schedule();
      return parseCdnSchedule(doc.leagueSchedule.gameDates.flatMap((d) => d.games));
    }
    const [games, espn] = await Promise.all([this.logGames(season), this.espnIndex(season)]);
    return games.map((g) => {
      let info = espn.get(espnKey(g.date, g.homeName, g.awayName));
      if (!info && g.ambiguousHome) {
        // A neutral-site game the log could not orient: ESPN has the designated home side.
        const flipped = espn.get(espnKey(g.date, g.awayName, g.homeName));
        if (flipped) {
          info = flipped;
          g = { ...g, homeTeamId: g.awayTeamId, awayTeamId: g.homeTeamId, homeName: g.awayName, awayName: g.homeName, homeScore: g.awayScore, awayScore: g.homeScore };
        }
      }
      const canonical = logGameToCanonical(g, info);
      return g.ambiguousHome ? { ...canonical, isNeutralSite: true } : canonical;
    });
  }

  /** The CDN schedule's games whose tip-off falls in the range (the current season only). */
  async fetchSchedule(range: DateRange): Promise<CanonicalGame[]> {
    const doc = await this.schedule();
    const start = `${range.start}T00:00:00Z`;
    const end = `${range.end}T23:59:59Z`;
    return parseCdnSchedule(doc.leagueSchedule.gameDates.flatMap((d) => d.games)).filter(
      (g) => g.scheduledStart >= start && g.scheduledStart <= end,
    );
  }

  /**
   * Detail for one game. `ctx` carries the schedule row's start, venue and neutral flag so a
   * rewrite of the games row keeps them; without it the CDN box supplies the start and arena
   * name, and the stats path supplies neither.
   */
  async fetchGameDetail(providerGameId: string, ctx?: Partial<DetailContext>): Promise<CanonicalGameDetail> {
    try {
      const [box, pbp] = await Promise.all([
        this.client.cdnBoxScore(providerGameId),
        this.client.cdnPlayByPlay(providerGameId),
      ]);
      const arena = box.game.arena?.arenaName;
      return parseCdnDetail(box, pbp, {
        providerGameId,
        scheduledStart: ctx?.scheduledStart ?? new Date(Date.parse(box.game.gameTimeUTC)).toISOString(),
        providerVenueId: ctx?.providerVenueId ?? (arena ? `name:${arena}` : null),
        venueName: ctx?.venueName ?? arena ?? null,
        isNeutralSite: ctx?.isNeutralSite ?? false,
      });
    } catch (err) {
      if (!(err instanceof NbaHttpError) || (err.status !== 403 && err.status !== 404)) throw err;
    }
    const [box, pbp, summary] = await Promise.all([
      this.client.statsBoxScore(providerGameId),
      this.client.statsPlayByPlay(providerGameId),
      this.client.boxScoreSummary(providerGameId).catch(() => null),
    ]);
    return parseStatsDetail(box.boxScoreTraditional, pbp, summary, {
      providerGameId,
      scheduledStart: ctx?.scheduledStart ?? new Date().toISOString(),
      providerVenueId: ctx?.providerVenueId ?? null,
      venueName: ctx?.venueName ?? null,
      isNeutralSite: ctx?.isNeutralSite ?? false,
    });
  }

  /** Today's scoreboard, for the game named. A game not on it is treated as not started. */
  async fetchLiveState(providerGameId: string): Promise<LiveState> {
    const fetchedAt = new Date().toISOString();
    const doc = await this.client.cdnScoreboard();
    const g = doc.scoreboard.games.find((x) => x.gameId === providerGameId);
    if (!g) return { status: 'scheduled', inning: null, inningState: null, clock: null, homeScore: 0, awayScore: 0, fetchedAt };
    return parseCdnLiveState(g, fetchedAt);
  }

  /** The team's roster today, from stats.nba.com, for the season in progress. */
  async fetchRoster(providerTeamId: string): Promise<RosterEntry[]> {
    const season = seasonForDate(new Date().toISOString().slice(0, 10));
    return parseNbaRoster(await this.client.commonTeamRoster(providerTeamId.split('-')[0]!, seasonString(season)));
  }
}
