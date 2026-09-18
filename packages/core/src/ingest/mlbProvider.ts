import {
  parseMlbFeed,
  parseMlbLiveState,
  parseMlbRoster,
  parseMlbSchedule,
  parseMlbTeams,
} from '../providers/mlb/parse.js';
import type {
  CanonicalGame,
  CanonicalGameDetail,
  CanonicalTeam,
  DateRange,
  LiveState,
  RosterEntry,
  SportsDataProvider,
} from '../types.js';
import { MlbClient } from './mlbClient.js';

/** SportsDataProvider for MLB (SPEC.md 4.4). */
export class MlbProvider implements SportsDataProvider {
  readonly sport = 'mlb' as const;
  private readonly homeVenueCache = new Map<number, Record<string, number>>();

  constructor(private readonly client: MlbClient = new MlbClient()) {}

  async homeVenueMap(season: number): Promise<Record<string, number>> {
    const cached = this.homeVenueCache.get(season);
    if (cached) return cached;
    const doc = await this.client.teams(season);
    const map: Record<string, number> = {};
    for (const t of doc.teams) if (t.venue) map[String(t.id)] = t.venue.id;
    this.homeVenueCache.set(season, map);
    return map;
  }

  async fetchTeams(): Promise<CanonicalTeam[]> {
    return parseMlbTeams(await this.client.teams(new Date().getUTCFullYear()));
  }

  async fetchSchedule(range: DateRange): Promise<CanonicalGame[]> {
    const doc = await this.client.schedule(range.start, range.end);
    const season = Number(range.start.slice(0, 4));
    return parseMlbSchedule(doc, { homeVenueIdByTeamId: await this.homeVenueMap(season) });
  }

  async fetchSeason(season: number): Promise<CanonicalGame[]> {
    const doc = await this.client.seasonSchedule(season);
    return parseMlbSchedule(doc, { homeVenueIdByTeamId: await this.homeVenueMap(season) });
  }

  async fetchGameDetail(providerGameId: string): Promise<CanonicalGameDetail> {
    return parseMlbFeed(await this.client.feed(providerGameId));
  }

  async fetchLiveState(providerGameId: string): Promise<LiveState> {
    return parseMlbLiveState(await this.client.feed(providerGameId), new Date().toISOString());
  }

  async fetchRoster(providerTeamId: string): Promise<RosterEntry[]> {
    return parseMlbRoster(await this.client.roster(providerTeamId));
  }
}
