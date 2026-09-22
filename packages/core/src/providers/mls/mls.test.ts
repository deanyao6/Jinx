import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { isMlsLeagueEvent, parseMlsEvent, mlsStatus, type MlsEvent } from './parse.js';
import { gameRow } from '../../rows.js';
import { gameResult } from '../../records.js';
import { MlsProvider } from '../../ingest/mlsProvider.js';

const fixtures = JSON.parse(
  readFileSync(
    new URL('../../../../../ingest/fixtures/mls/schedules.json', import.meta.url),
    'utf8',
  ),
) as MlsEvent[];
const cup = fixtures.find((e) => e.id === '655997')!;
const clone = () => structuredClone(cup);
const historical = JSON.parse(
  readFileSync(
    new URL('../../../../../ingest/fixtures/mls/historical.json', import.meta.url),
    'utf8',
  ),
) as MlsEvent[];

describe('MLS schedules and outcomes', () => {
  it('parses every captured supported historical format and excludes tournament rounds', () => {
    const included = historical.filter(isMlsLeagueEvent);
    expect(included.map(parseMlsEvent)).toHaveLength(12);
    expect(
      historical
        .filter((e) => !isMlsLeagueEvent(e))
        .map((e) => e.season.slug)
        .sort(),
    ).toEqual(['all-star-game', 'mls-is-back---quarterfinals', 'mls-is-back---round-of-16']);
  });
  it('parses captured historical regular season and MLS Cup formats', () => {
    expect(
      historical
        .slice(0, 4)
        .map(parseMlsEvent)
        .map((g) => g.gameType),
    ).toEqual(['regular', 'postseason', 'postseason', 'postseason']);
    expect(parseMlsEvent(historical.find((e) => e.id === '468711')!)).toMatchObject({
      homeScore: 0,
      awayScore: 0,
      decisionMethod: 'shootout',
      winnerProviderTeamId: '9726',
    });
  });
  it('preserves the captured 2016 match result separately from series advancement', () => {
    expect(parseMlsEvent(historical.find((e) => e.id === '468040')!)).toMatchObject({
      homeScore: 1,
      awayScore: 0,
      homeShootoutScore: 3,
      awayShootoutScore: 1,
      decisionMethod: 'aggregate_shootout',
      winnerProviderTeamId: '184',
      isTie: false,
    });
    // Seattle advanced, but Dallas won the second leg.
    expect(parseMlsEvent(historical.find((e) => e.id === '468038')!)).toMatchObject({
      homeScore: 2,
      awayScore: 1,
      winnerProviderTeamId: '185',
      isTie: false,
    });
  });
  it('excludes the All-Star exhibition even when ESPN labels it regular-season', () => {
    const e = clone();
    e.season.slug = 'regular-season';
    e.competitions[0]!.competitors[0]!.team.id = '9817';
    expect(isMlsLeagueEvent(e)).toBe(false);
    expect(() => parseMlsEvent(e)).toThrow('outside league coverage');
  });
  it('parses the captured final, scheduled and MLS Cup responses', () => {
    expect(fixtures.map(parseMlsEvent).every((g) => g.sport === 'mls')).toBe(true);
  });
  it('keeps goals separate from shootout kicks in the 2022 final', () => {
    const g = parseMlsEvent(cup);
    expect(g).toMatchObject({
      homeScore: 3,
      awayScore: 3,
      homeShootoutScore: 3,
      awayShootoutScore: 0,
      winnerProviderTeamId: '18966',
      isTie: false,
      decisionMethod: 'shootout',
      gameType: 'postseason',
    });
    const row = gameRow(g, {
      teamMap: new Map([
        ['18966', 'lafc'],
        ['10739', 'phi'],
      ]),
      resolveVenue: () => null,
    });
    expect(row).toMatchObject({
      home_score: 3,
      away_score: 3,
      winner_team_id: 'lafc',
      home_shootout_score: 3,
      season_key: 'mls:2022',
    });
    const attended = {
      gameId: 'cup',
      status: g.status,
      scheduledStart: g.scheduledStart,
      homeTeamId: 'lafc',
      awayTeamId: 'phi',
      homeScore: 3,
      awayScore: 3,
      winnerTeamId: 'lafc',
      rootingTeamId: 'lafc',
      rootingBasis: 'favorite' as const,
    };
    expect(gameResult(attended, 'lafc')).toBe('win');
    expect(gameResult(attended, 'phi')).toBe('loss');
  });
  it.each(['0', '2'])('keeps a %s-all regular-season draw', (goals) => {
    const e = clone();
    e.season.slug = 'regular-season';
    const c = e.competitions[0]!;
    c.status.type = { name: 'STATUS_FULL_TIME', state: 'post', completed: true };
    c.competitors.forEach((t) => {
      t.score = goals;
      delete t.shootoutScore;
    });
    expect(parseMlsEvent(e)).toMatchObject({
      isTie: true,
      winnerProviderTeamId: null,
      homeShootoutScore: null,
    });
  });
  it('does not publish zero-zero as a score before kickoff', () => {
    const e = clone();
    e.competitions[0]!.status.type = { name: 'STATUS_SCHEDULED', state: 'pre', completed: false };
    expect(parseMlsEvent(e)).toMatchObject({
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
      decisionMethod: null,
      isTie: false,
    });
  });
  it('recognizes extra time, not as a shootout', () => {
    const e = clone();
    const c = e.competitions[0]!;
    c.status.type.name = 'STATUS_FINAL_AET';
    c.competitors[0]!.score = '4';
    expect(parseMlsEvent(e)).toMatchObject({
      decisionMethod: 'extra_time',
      homeScore: 4,
      awayScore: 3,
      homeShootoutScore: null,
    });
  });
  it('refuses incomplete final scores and shootout results', () => {
    const e = clone();
    delete e.competitions[0]!.competitors[0]!.shootoutScore;
    expect(() => parseMlsEvent(e)).toThrow('Invalid MLS shootout');
    const missing = clone();
    delete missing.competitions[0]!.competitors[0]!.score;
    expect(() => parseMlsEvent(missing)).toThrow('Missing MLS final score');
  });
  it('does not confuse a two-leg series winner with the match winner', () => {
    const e = clone();
    const c = e.competitions[0]!;
    c.status.type.name = 'STATUS_FULL_TIME';
    c.competitors[0]!.score = '0';
    c.competitors[1]!.score = '1';
    expect(parseMlsEvent(e).winnerProviderTeamId).toBe('10739');
  });
  it.each([
    'regular-season-2016',
    'semi-finals---western-conf',
    'eastern-conference-playoffs---round-one',
  ])('accepts verified historical format %s', (slug) => {
    const e = clone();
    e.season = { year: 2016, type: 1, slug };
    expect(parseMlsEvent(e).seasonKey).toBe('mls:2016');
  });
  it.each(['all-star-game', 'mls-is-back---round-of-16', 'mls-is-back---quarterfinals'])(
    'excludes %s',
    (slug) => {
      const e = clone();
      e.season.slug = slug;
      expect(isMlsLeagueEvent(e)).toBe(false);
    },
  );
  it.each([
    ['1', '0', '18966'],
    ['0', '1', '10739'],
    ['1', '1', null],
  ])('keeps a %s-%s match result separate from series penalties', (home, away, winner) => {
    const e = clone();
    const c = e.competitions[0]!;
    c.leg = { value: 2 };
    c.competitors[0]!.score = home;
    c.competitors[1]!.score = away;
    c.competitors.forEach((t) => {
      t.aggregateScore = 2;
    });
    const g = parseMlsEvent(e);
    expect(g).toMatchObject({
      decisionMethod: 'aggregate_shootout',
      winnerProviderTeamId: winner,
      isTie: winner === null,
      homeShootoutScore: 3,
    });
    const row = gameRow(g, {
      teamMap: new Map([
        ['18966', 'lafc'],
        ['10739', 'phi'],
      ]),
      resolveVenue: () => null,
    });
    expect(row.winner_team_id).toBe(winner === null ? null : winner === '18966' ? 'lafc' : 'phi');
  });
  it('rejects missing or unequal aggregate scores for series penalties', () => {
    const e = clone();
    const c = e.competitions[0]!;
    c.leg = { value: 2 };
    expect(() => parseMlsEvent(e)).toThrow('aggregate shootout');
    c.competitors[0]!.aggregateScore = 2;
    c.competitors[1]!.aggregateScore = 1;
    expect(() => parseMlsEvent(e)).toThrow('aggregate shootout');
  });
  it('refuses unsupported cups and unverified 2027 season mappings', () => {
    const e = clone();
    e.season.slug = 'leagues-cup';
    expect(() => parseMlsEvent(e)).toThrow('season type');
    e.season.slug = 'regular-season';
    e.season.year = 2027;
    expect(() => parseMlsEvent(e)).toThrow('season mapping');
  });
  it.each([
    ['STATUS_POSTPONED', 'postponed'],
    ['STATUS_SUSPENDED', 'suspended'],
    ['STATUS_CANCELED', 'cancelled'],
  ])('maps %s without counting it as final', (name, status) => {
    expect(mlsStatus(name, 'post', true)).toBe(status);
  });
  it('throws on unrecognized status instead of inventing a final', () => {
    expect(() => mlsStatus('NEW_STATUS', 'post', true)).toThrow('Unknown MLS status');
  });
});

describe('MLS provider', () => {
  it('refuses malformed or truncated responses', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ events: Array(1000).fill(cup) })));
    await expect(new MlsProvider({ fetchImpl, intervalMs: 0 }).month(2022, 11)).rejects.toThrow(
      'Incomplete',
    );
  });
  it('does not retry forbidden requests', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 403 }));
    await expect(new MlsProvider({ fetchImpl, intervalMs: 0 }).month(2022, 11)).rejects.toThrow(
      '403',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('caches within the TTL and refreshes expired entries', async () => {
    let now = 1;
    const entries = new Map<string, string>();
    const fetchImpl = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify({ events: [] })));
    const client = new MlsProvider({
      fetchImpl,
      intervalMs: 0,
      now: () => now,
      cache: {
        get: async (k) => entries.get(k) ?? null,
        set: async (k, v) => {
          entries.set(k, v);
        },
      },
    });
    await client.month(2026, 9);
    await client.month(2026, 9);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    now += 3600001;
    await client.month(2026, 9);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

it('uses the sourced venue correction only for the missing Union–Toronto venue', () => {
  const e = clone();
  e.id = '623627';
  delete e.competitions[0]!.venue;
  expect(parseMlsEvent(e)).toMatchObject({
    providerVenueId: 'espn:4061',
    venueName: 'Subaru Park',
  });
  e.id = 'unmapped';
  expect(parseMlsEvent(e).providerVenueId).toBeNull();
});
