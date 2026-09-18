/**
 * Thin, rate-limited HTTP client for the MLB Stats API (docs/verification.md).
 * Never call this from the app; ingestion only.
 */
import type {
  MlbFeed,
  MlbRosterResponse,
  MlbScheduleResponse,
  MlbTeamsResponse,
} from '../providers/mlb/parse.js';

export interface MlbVenuesResponse {
  venues: { id: number; name: string }[];
}

/**
 * GET v1/awards/{awardId}/recipients?season=YYYY (verified 2026-09-17, docs/verification.md).
 * One row per recipient; an All-Star award has thirty-odd, an MVP one. No voting placements
 * exist anywhere in the API, so "top five in the voting" cannot come from here.
 */
export interface MlbAwardRecipientsResponse {
  awards: {
    id: string;
    name: string;
    date?: string;
    season: string;
    team?: { id: number };
    player: { id: number; nameFirstLast?: string; fullName?: string };
  }[];
}

/** GET v1/people?personIds=1,2,3 (verified 2026-09-17). mlbDebutDate is the debut badge. */
export interface MlbPeopleResponse {
  people: {
    id: number;
    fullName: string;
    mlbDebutDate?: string;
    active?: boolean;
  }[];
}

/**
 * GET v1/transactions?teamId=&startDate=&endDate= (verified 2026-09-17). A trade is one row
 * per player moved, each with the team he went TO, so the row whose toTeam is the queried team
 * is the join. typeCode: TR trade, SFA signed as free agent, SGN signed, CLW claimed off
 * waivers, SEL selected (Rule 5), PUR purchased; SC, ASG, OPT, DFA, REL are not joins.
 */
export interface MlbTransactionsResponse {
  transactions: {
    id: number;
    person?: { id: number; fullName?: string };
    toTeam?: { id: number; name?: string };
    fromTeam?: { id: number; name?: string };
    date: string;
    effectiveDate?: string;
    typeCode: string;
    typeDesc?: string;
    description?: string;
  }[];
}

export interface MlbClientOptions {
  baseUrl?: string;
  /** Minimum milliseconds between requests. */
  minIntervalMs?: number;
  fetchImpl?: typeof fetch;
  userAgent?: string;
}

export class MlbClient {
  private readonly baseUrl: string;
  private readonly minInterval: number;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;
  private lastRequestAt = 0;

  constructor(opts: MlbClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? 'https://statsapi.mlb.com/api/';
    this.minInterval = opts.minIntervalMs ?? 250;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.userAgent = opts.userAgent ?? 'jinx-ingest/0.1 (personal, non-commercial)';
  }

  private async throttle(): Promise<void> {
    const wait = this.lastRequestAt + this.minInterval - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestAt = Date.now();
  }

  async getJson<T>(path: string, attempt = 0): Promise<T> {
    await this.throttle();
    const url = this.baseUrl + path;
    const res = await this.fetchImpl(url, { headers: { 'user-agent': this.userAgent } });
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 4) throw new Error(`MLB ${res.status} for ${url}`);
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      return this.getJson<T>(path, attempt + 1);
    }
    if (!res.ok) throw new Error(`MLB ${res.status} for ${url}`);
    return (await res.json()) as T;
  }

  schedule(startDate: string, endDate: string): Promise<MlbScheduleResponse> {
    return this.getJson(`v1/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}`);
  }

  seasonSchedule(season: number): Promise<MlbScheduleResponse> {
    return this.getJson(`v1/schedule?sportId=1&season=${season}&gameType=R,F,D,L,W,S`);
  }

  feed(gamePk: string | number): Promise<MlbFeed> {
    return this.getJson(`v1.1/game/${gamePk}/feed/live`);
  }

  teams(season: number): Promise<MlbTeamsResponse & { teams: { venue?: { id: number } }[] }> {
    return this.getJson(`v1/teams?sportId=1&season=${season}`);
  }

  /**
   * The 40-man roster: the active 26 (28 in September) plus every injured list, plus players
   * optioned to the minors; parseMlbRoster keeps the first two. `active` would miss a star on
   * the 60-day IL, who is exactly who a fan wants to follow.
   */
  roster(teamId: string | number, rosterType = '40Man'): Promise<MlbRosterResponse> {
    return this.getJson(`v1/teams/${teamId}/roster?rosterType=${rosterType}`);
  }

  /** The recipients of one award in one season: ALMVP, NLCY, ALROY, NLAS and so on. */
  awardRecipients(awardId: string, season: number): Promise<MlbAwardRecipientsResponse> {
    return this.getJson(`v1/awards/${awardId}/recipients?season=${season}`);
  }

  /** Up to a few hundred people in one request; the caller chunks. */
  people(personIds: readonly (string | number)[]): Promise<MlbPeopleResponse> {
    return this.getJson(`v1/people?personIds=${personIds.join(',')}`);
  }

  /** A team's transactions in a date range (YYYY-MM-DD, inclusive). */
  transactions(teamId: string | number, startDate: string, endDate: string): Promise<MlbTransactionsResponse> {
    return this.getJson(`v1/transactions?teamId=${teamId}&startDate=${startDate}&endDate=${endDate}`);
  }
}
