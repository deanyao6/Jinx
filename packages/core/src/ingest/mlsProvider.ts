import type { CanonicalGameDetail, DateRange, SportsDataProvider } from '../types.js';
import {
  isMlsLeagueEvent,
  parseMlsEvent,
  parseMlsTeam,
  type MlsScoreboard,
  type MlsTeam,
} from '../providers/mls/parse.js';
import type { ResponseCache } from './nbaClient.js';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/';

/** Server-only, bounded retries, one request per second, with expiring disk cache. */
export class MlsProvider implements SportsDataProvider {
  readonly sport = 'mls' as const;
  private lastRequest = 0;
  constructor(
    private readonly options: {
      cache?: ResponseCache;
      fetchImpl?: typeof fetch;
      intervalMs?: number;
      now?: () => number;
    } = {},
  ) {}

  async get<T>(path: string, ttlMs = 0): Promise<T> {
    const now = this.options.now ?? Date.now;
    const cached = ttlMs ? await this.options.cache?.get(path) : null;
    if (cached) {
      const entry = JSON.parse(cached) as { at: number; data: T };
      if (now() - entry.at < ttlMs) return entry.data;
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const wait = Math.max(0, (this.options.intervalMs ?? 1000) - (now() - this.lastRequest));
      if (wait) await new Promise((r) => setTimeout(r, wait));
      this.lastRequest = now();
      const response = await (this.options.fetchImpl ?? fetch)(BASE + path, {
        signal: AbortSignal.timeout(20000),
      });
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      if (!response.ok) throw new Error(`MLS provider HTTP ${response.status}: ${path}`);
      const data = (await response.json()) as T;
      if (ttlMs) await this.options.cache?.set(path, JSON.stringify({ at: now(), data }));
      return data;
    }
    throw new Error(`MLS retry limit: ${path}`);
  }

  async rawTeams(): Promise<MlsTeam[]> {
    const d = await this.get<{ sports: { leagues: { teams: { team: MlsTeam }[] }[] }[] }>(
      'teams?limit=100',
      86400000,
    );
    const teams = d.sports?.[0]?.leagues?.[0]?.teams;
    if (!teams?.length) throw new Error('MLS teams response is empty');
    return teams.map((t) => t.team);
  }
  async fetchTeams() {
    return (await this.rawTeams()).map(parseMlsTeam);
  }

  async month(year: number, month: number, force = false): Promise<MlsScoreboard> {
    const key = `${year}${String(month).padStart(2, '0')}`;
    const d = await this.get<MlsScoreboard>(
      `scoreboard?dates=${key}&limit=1000`,
      force ? 0 : 3600000,
    );
    if (!Array.isArray(d.events) || d.events.length >= 1000)
      throw new Error(`Incomplete MLS month ${key}`);
    return d;
  }

  async fetchSchedule(range: DateRange) {
    const start = new Date(`${range.start}T00:00:00Z`);
    const end = new Date(`${range.end}T23:59:59Z`);
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || start > end)
      throw new Error('Invalid MLS date range');
    const games = new Map<string, ReturnType<typeof parseMlsEvent>>();
    for (
      const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      date <= end;
      date.setUTCMonth(date.getUTCMonth() + 1)
    ) {
      for (const e of (await this.month(date.getUTCFullYear(), date.getUTCMonth() + 1)).events) {
        if (!isMlsLeagueEvent(e)) continue;
        const game = parseMlsEvent(e);
        if (Date.parse(game.scheduledStart) >= +start && Date.parse(game.scheduledStart) <= +end)
          games.set(game.providerGameId, game);
      }
    }
    return [...games.values()];
  }

  fetchGameDetail(): Promise<CanonicalGameDetail> {
    return Promise.reject(
      new Error('MLS detail ingestion is not enabled; schedules and final scores only'),
    );
  }
}
