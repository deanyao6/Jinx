/**
 * NBA parsers, detectors and rules against the real responses in ingest/fixtures/nba
 * (docs/verification.md, "NBA data sources").
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ELO_PARAMS } from '../../elo.js';
import { highlightsSiteLabel, officialHighlightsUrl } from '../../highlights.js';
import type {
  CdnBoxscore,
  CdnPlayByPlay,
  CdnScheduleGame,
  EspnEvent,
  EspnSummary,
  StatsAction,
  StatsBoxScore,
  StatsResponse,
} from '../../ingest/nbaClient.js';
import { estimatedLock, trueLock, validatePledge } from '../../pledge.js';
import { scoringLines, scoringNote, scoringWhen } from '../../scoring.js';
import type { CanonicalGameDetail, NbaBoxLine } from '../../types.js';
import {
  NBA_TEAM_ERAS,
  clockLabel,
  clockToSeconds,
  easternDateOf,
  gameTypeFromId,
  nbaProviderTeamId,
  seasonForDate,
  seasonFromGameId,
  seasonString,
} from './ids.js';
import { detectNbaMoments, doubleDigitCategories } from './moments.js';
import {
  espnKey,
  indexEspn,
  logGameToCanonical,
  parseCdnDetail,
  parseCdnLiveState,
  parseCdnSchedule,
  parseEspnScoreboard,
  parseGameLog,
  parseNbaRoster,
  parseStatsDetail,
} from './parse.js';
import {
  MAX_STEPS,
  buildNbaStorySteps,
  modelHomeWp,
  modelPointFinder,
  modelWinProbability,
  parseEspnWinProbability,
  selectStepRows,
  espnPointFinder,
} from './winprob.js';

const FIX = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../ingest/fixtures/nba',
);
const SEED = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../seed');
const load = <T>(name: string): T => JSON.parse(readFileSync(path.join(FIX, name), 'utf8')) as T;

describe('ids', () => {
  it('reads the season and type off a game id', () => {
    expect(seasonFromGameId('0022400001')).toBe(2024);
    expect(seasonFromGameId('0020000001')).toBe(2000);
    expect(gameTypeFromId('0022400001')).toBe('regular');
    expect(gameTypeFromId('0042300151')).toBe('postseason');
    expect(gameTypeFromId('0052300121')).toBe('postseason');
    expect(gameTypeFromId('0062300001')).toBe('regular');
    expect(gameTypeFromId('0012300001')).toBe('preseason');
    expect(seasonString(2024)).toBe('2024-25');
    expect(seasonFromGameId('abc')).toBeNull();
  });
  it('maps a team id and season to the identity of the time', () => {
    expect(nbaProviderTeamId(1610612760, 2005)).toBe('1610612760-SEA');
    expect(nbaProviderTeamId(1610612760, 2008)).toBe('1610612760');
    expect(nbaProviderTeamId('1610612766', 2001)).toBe('1610612766-CHH');
    expect(nbaProviderTeamId('1610612766', 2010)).toBe('1610612766-CHA-bobcats');
    expect(nbaProviderTeamId('1610612766', 2014)).toBe('1610612766');
    expect(nbaProviderTeamId('1610612747', 2000)).toBe('1610612747');
  });
  it('agrees with the seed on every era', () => {
    const seed = JSON.parse(readFileSync(path.join(SEED, 'nba_teams.json'), 'utf8')).teams as {
      provider_team_id: string;
      team_id: string;
      first: number;
      last: number | null;
      active: boolean;
    }[];
    for (const era of NBA_TEAM_ERAS) {
      const row = seed.find((t) => t.provider_team_id === era.providerTeamId);
      expect(row, era.providerTeamId).toBeDefined();
      expect(row!.first).toBe(era.first);
      expect(row!.last).toBe(era.last);
      expect(row!.team_id).toBe(era.teamId);
    }
    for (const t of seed.filter((t) => !t.active)) {
      expect(
        NBA_TEAM_ERAS.some((e) => e.providerTeamId === t.provider_team_id),
        t.provider_team_id,
      ).toBe(true);
    }
    expect(seed.filter((t) => t.active)).toHaveLength(30);
  });
  it('dates a game in the Eastern zone and reads clocks', () => {
    expect(easternDateOf('2016-10-26T02:30:00Z')).toBe('2016-10-25');
    expect(easternDateOf('2024-11-13T00:00:00Z')).toBe('2024-11-12');
    expect(easternDateOf('2025-01-16T01:00:00Z')).toBe('2025-01-15');
    expect(seasonForDate('2025-04-10')).toBe(2024);
    expect(seasonForDate('2025-10-22')).toBe(2025);
    expect(clockToSeconds('PT11M43.00S')).toBeCloseTo(703);
    expect(clockToSeconds('PT00M00.90S')).toBeCloseTo(0.9);
    expect(clockToSeconds('7.1')).toBeCloseTo(7.1);
    expect(clockLabel('PT11M43.00S')).toBe('11:43');
    expect(clockLabel('PT00M00.90S')).toBe('0:00.9');
    expect(clockLabel(null)).toBeNull();
  });
});

describe('game log + ESPN', () => {
  const log = load<StatsResponse>('stats_leaguegamelog_2016-17_first40_2026-09-17.json');
  it('takes only the Cup final from the IST set, and the play-in as postseason', () => {
    const ist = parseGameLog(
      load<StatsResponse>('stats_leaguegamelog_2023-24_IST_trimmed_2026-09-18.json'),
    );
    const final = ist.filter((g) => g.gameId.startsWith('006'));
    expect(final).toHaveLength(1);
    expect(final[0]!.date).toBe('2023-12-09');
    expect(logGameToCanonical(final[0]!, undefined)).toMatchObject({
      gameType: 'regular',
      isNeutralSite: true,
    });
    const playIn = parseGameLog(
      load<StatsResponse>('stats_leaguegamelog_2023-24_PlayIn_2026-09-18.json'),
    );
    expect(playIn).toHaveLength(6);
    expect(playIn.every((g) => g.gameId.startsWith('005'))).toBe(true);
    expect(gameTypeFromId(playIn[0]!.gameId)).toBe('postseason');
  });
  it('pairs the two rows of a game and knows who was home', () => {
    const games = parseGameLog(log);
    // 40 rows: 20 games when every pair is present; the fixture is a prefix, so at least 15.
    expect(games.length).toBeGreaterThanOrEqual(15);
    const first = games.find((g) => g.gameId === '0021600001')!;
    expect(first.homeTeamId).toBe('1610612739');
    expect(first.awayTeamId).toBe('1610612752');
    expect(first.homeScore).toBe(117);
    expect(first.awayScore).toBe(88);
    expect(first.date).toBe('2016-10-25');
    expect(first.season).toBe(2016);
  });
  it('matches ESPN by Eastern date and nicknames, and takes its time and venue', () => {
    const espn = load<{ events: EspnEvent[] }>('espn_scoreboard_20161025_2026-09-18.json');
    const infos = parseEspnScoreboard(espn.events);
    expect(infos).toHaveLength(3);
    const index = indexEspn(infos);
    const game = parseGameLog(log).find((g) => g.gameId === '0021600001')!;
    const hit = index.get(espnKey(game.date, game.homeName, game.awayName));
    expect(hit?.eventId).toBe('400899375');
    const canonical = logGameToCanonical(game, hit);
    expect(canonical.scheduledStart).toBe('2016-10-25T23:30:00.000Z');
    expect(canonical.providerVenueId).toBe('espn:3417');
    expect(canonical.status).toBe('final');
    expect(canonical.homeProviderTeamId).toBe('1610612739');
    expect(canonical.isNeutralSite).toBe(false);
    // Without ESPN: the log's date at a default evening tip, no venue.
    const bare = logGameToCanonical(game, undefined);
    expect(bare.scheduledStart).toBe('2016-10-25T23:00:00.000Z');
    expect(bare.providerVenueId).toBeNull();
  });
  it('orients a neutral-site game the log marks @ on both rows by the first row, flagged', () => {
    const rows = [
      [
        '22024',
        1610612764,
        'WAS',
        'Washington Wizards',
        '0022400147',
        '2024-11-02',
        'WAS @ MIA',
        'W',
        240,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        102,
        5,
        1,
      ],
      [
        '22024',
        1610612748,
        'MIA',
        'Miami Heat',
        '0022400147',
        '2024-11-02',
        'MIA @ WAS',
        'L',
        240,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        97,
        -5,
        1,
      ],
    ];
    const games = parseGameLog({
      resultSets: [{ name: 'LeagueGameLog', headers: log.resultSets[0]!.headers, rowSet: rows }],
    });
    expect(games).toHaveLength(1);
    expect(games[0]!.ambiguousHome).toBe(true);
    expect(games[0]!.homeTeamId).toBe('1610612764');
  });
  it('keys the Trail Blazers and the 76ers by their last word', () => {
    expect(espnKey('2024-01-01', 'Portland Trail Blazers', 'Philadelphia 76ers')).toBe(
      '2024-01-01|blazers|76ers',
    );
  });
});

describe('CDN schedule', () => {
  const doc = load<{ leagueSchedule: { gameDates: { games: CdnScheduleGame[] }[] } }>(
    'cdn_schedule_2026-27_trimmed_2026-09-17.json',
  );
  it('keeps stored game types with real tip-off times and arena names', () => {
    const games = parseCdnSchedule(doc.leagueSchedule.gameDates.flatMap((d) => d.games));
    expect(games.length).toBeGreaterThan(0);
    const g = games[0]!;
    expect(g.gameType).toBe('preseason');
    expect(g.scheduledStart).toBe('2026-10-03T23:00:00.000Z');
    expect(g.providerVenueId).toBe('name:Videotron Centre');
    expect(g.status).toBe('scheduled');
    expect(g.homeScore).toBeNull();
    expect(g.season).toBe(2026);
  });
});

describe('detail from the CDN', () => {
  const box = load<CdnBoxscore>('cdn_boxscore_0022400001_2026-09-17.json');
  const pbp = load<CdnPlayByPlay>('cdn_playbyplay_0022400001_2026-09-17.json');
  const ctx = {
    providerGameId: '0022400001',
    scheduledStart: '2024-11-13T00:00:00.000Z',
    providerVenueId: 'espn:1824',
    venueName: 'TD Garden',
    isNeutralSite: false,
  };
  const detail = parseCdnDetail(box, pbp, ctx);
  it('reads the score, context and plays', () => {
    expect(detail.homeScore).toBe(116);
    expect(detail.awayScore).toBe(117);
    expect(detail.status).toBe('final');
    expect(detail.attendance).toBe(19156);
    expect(detail.durationMinutes).toBe(133);
    expect(detail.inningsOrPeriods).toBe(4);
    expect(detail.plays.sport).toBe('nba');
    expect(detail.plays.items.length).toBe(538);
    expect(detail.timestampsReliable).toBe(true);
    expect(detail.scheduledStart).toBe(ctx.scheduledStart);
    expect(detail.providerVenueId).toBe('espn:1824');
  });
  it('builds the scoring timeline with kinds and named scorers', () => {
    const t = detail.timeline;
    expect(t.length).toBeGreaterThan(80);
    expect(t[t.length - 1]!.homeScore).toBe(116);
    expect(t[t.length - 1]!.awayScore).toBe(117);
    expect(t[0]!.kind).toBe('three');
    expect(t[0]!.scorerName).toBe('Jalen Johnson');
    expect(t[0]!.scoringSide).toBe('away');
    expect(t[0]!.clock).toBe('10:50');
    expect(t[0]!.occurredAt).toBe('2024-11-13T00:11:45.500Z');
    expect(t.every((e) => e.scorerName && e.kind)).toBe(true);
    // Scores only ever move forward.
    for (let i = 1; i < t.length; i++) {
      expect(t[i]!.homeScore + t[i]!.awayScore).toBeGreaterThan(
        t[i - 1]!.homeScore + t[i - 1]!.awayScore,
      );
    }
    const kinds = new Set(t.map((e) => e.kind));
    expect(kinds.has('free_throw')).toBe(true);
    expect(kinds.has('dunk') || kinds.has('layup')).toBe(true);
  });
  it('lists everyone who played, with a box line each', () => {
    expect(detail.appearances.length).toBeGreaterThanOrEqual(18);
    expect(
      detail.appearances.every(
        (a) => a.providerTeamId === '1610612738' || a.providerTeamId === '1610612737',
      ),
    ).toBe(true);
    const brown = detail.boxLines!.find((l) => l.playerName === 'Jaylen Brown')!;
    expect(brown.side).toBe('home');
    expect(brown.points).toBeGreaterThan(0);
    // Someone who did not play is not an appearance.
    expect(detail.appearances.some((a) => a.fullName === 'Drew Peterson')).toBe(false);
  });
  it('locks a pick at the end of the first period, with the wall clock', () => {
    const lock = trueLock(detail);
    expect(lock.reason).toBe('end_of_first');
    expect(lock.reliable).toBe(true);
    expect(lock.at).toBe('2024-11-13T00:37:54.700Z');
    expect(validatePledge('2024-11-13T00:30:00Z', lock).status).toBe('valid');
    expect(validatePledge('2024-11-13T00:38:30Z', lock)).toEqual({
      status: 'valid',
      reason: 'before_lock',
    });
    expect(validatePledge('2024-11-13T00:40:00Z', lock)).toEqual({
      status: 'void',
      reason: 'after_lock',
    });
  });
});

describe('detail from stats.nba.com', () => {
  const box = load<{ boxScoreTraditional: StatsBoxScore }>(
    'stats_boxscoretraditionalv3_0021600001_2026-09-17.json',
  );
  const pbp = load<{ game: { actions: StatsAction[] } }>(
    'stats_playbyplayv3_0021600001_2026-09-17.json',
  );
  const ctx = {
    providerGameId: '0021600001',
    scheduledStart: '2016-10-25T23:30:00.000Z',
    providerVenueId: 'espn:3417',
    venueName: 'Rocket Arena',
    isNeutralSite: false,
  };
  const detail = parseStatsDetail(box.boxScoreTraditional, pbp, null, ctx);
  it('reads the final from the plays and names the scorers in full', () => {
    expect(detail.homeScore).toBe(117);
    expect(detail.awayScore).toBe(88);
    expect(detail.timeline[0]!.scorerName).toBe('Derrick Rose');
    expect(detail.timeline[0]!.kind).toBe('layup');
    expect(detail.timeline[0]!.occurredAt).toBeNull();
    expect(detail.timestampsReliable).toBe(false);
    expect(detail.appearances.some((a) => a.fullName === 'LeBron James')).toBe(true);
  });
  it('never voids a pledge without wall-clock times', () => {
    const lock = trueLock(detail);
    expect(lock.at).toBeNull();
    expect(validatePledge('2016-10-26T03:00:00Z', lock)).toEqual({
      status: 'valid',
      reason: 'unreliable_timestamps',
    });
  });
  it('ignores the zeroed scores the feed prints on a missed free throw', () => {
    const t = detail.timeline;
    for (let i = 1; i < t.length; i++) {
      expect(t[i]!.homeScore).toBeGreaterThanOrEqual(t[i - 1]!.homeScore);
      expect(t[i]!.awayScore).toBeGreaterThanOrEqual(t[i - 1]!.awayScore);
    }
  });
  it('finds the triple-double in the box', () => {
    const james = detail.boxLines!.find((l) => l.playerName === 'LeBron James')!;
    expect(james.points).toBe(19);
    expect(james.rebounds).toBe(11);
    expect(james.assists).toBe(14);
    const events = detectNbaMoments(detail);
    const td = events.find((e) => e.type === 'triple_double');
    expect(td?.playerName).toBe('LeBron James');
    expect(td?.side).toBe('home');
  });
});

describe('moments', () => {
  const box = load<CdnBoxscore>('cdn_boxscore_0022400001_2026-09-17.json');
  const pbp = load<CdnPlayByPlay>('cdn_playbyplay_0022400001_2026-09-17.json');
  const base = parseCdnDetail(box, pbp, {
    providerGameId: '0022400001',
    scheduledStart: '2024-11-13T00:00:00Z',
    providerVenueId: null,
    venueName: null,
    isNeutralSite: false,
  });
  const line = (over: Partial<NbaBoxLine>): NbaBoxLine => ({
    playerId: 'p',
    playerName: 'Test Player',
    side: 'home',
    minutes: 30,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    ...over,
  });
  it('a regulation game with no big lines has no moments', () => {
    const events = detectNbaMoments(base);
    expect(events.map((e) => e.type)).not.toContain('overtime');
    expect(events.map((e) => e.type)).not.toContain('buzzer_beater');
  });
  it('overtime from the period count', () => {
    const d: CanonicalGameDetail = { ...base, inningsOrPeriods: 5 };
    expect(detectNbaMoments(d).some((e) => e.type === 'overtime')).toBe(true);
  });
  it('box score moments', () => {
    const d: CanonicalGameDetail = {
      ...base,
      boxLines: [
        line({ playerId: '1', playerName: 'Fifty', points: 52 }),
        line({ playerId: '2', playerName: 'Triple', points: 12, rebounds: 10, assists: 11 }),
        line({
          playerId: '3',
          playerName: 'Quad',
          points: 12,
          rebounds: 10,
          assists: 11,
          blocks: 10,
        }),
        line({ playerId: '4', playerName: 'Boards', rebounds: 21, side: 'away' }),
        line({ playerId: '5', playerName: 'Dimes', assists: 20 }),
        line({ playerId: '6', playerName: 'Nobody', points: 9, rebounds: 9, assists: 9 }),
      ],
    };
    const events = detectNbaMoments(d);
    const by = (type: string) => events.filter((e) => e.type === type).map((e) => e.playerName);
    expect(by('fifty_points')).toEqual(['Fifty']);
    expect(by('triple_double')).toEqual(['Triple']);
    expect(by('quadruple_double')).toEqual(['Quad']);
    expect(by('twenty_rebounds')).toEqual(['Boards']);
    expect(by('twenty_assists')).toEqual(['Dimes']);
    expect(events.find((e) => e.type === 'twenty_rebounds')?.side).toBe('away');
    expect(
      doubleDigitCategories(
        line({ points: 10, rebounds: 10, assists: 10, steals: 10, blocks: 10 }),
      ),
    ).toBe(5);
  });
  it('a buzzer-beater is a made basket at 1.0 s or less that ties or wins', () => {
    const plays = base.plays.sport === 'nba' ? base.plays.items : [];
    const last = plays[plays.length - 1]!;
    const winner = {
      ...last,
      actionNumber: last.actionNumber + 1,
      period: 4,
      clock: '0:00.6',
      periodSecondsRemaining: 0.6,
      actionType: '2pt',
      subType: 'Layup',
      isFieldGoal: true,
      shotMade: true,
      isScoringPlay: true,
      side: 'home' as const,
      playerId: '1627759',
      playerName: 'Jaylen Brown',
      points: 2,
      homeScore: 118,
      awayScore: 117,
      description: 'J. Brown layup',
    };
    const d: CanonicalGameDetail = {
      ...base,
      homeScore: 118,
      awayScore: 117,
      plays: { sport: 'nba', items: [...plays, winner] },
    };
    const bb = detectNbaMoments(d).find((e) => e.type === 'buzzer_beater');
    expect(bb?.playerName).toBe('Jaylen Brown');
    expect(bb?.detail['winning']).toBe(true);
    // The same shot with 1.5 s left is not one.
    const early = { ...winner, clock: '0:01.5', periodSecondsRemaining: 1.5 };
    const d2: CanonicalGameDetail = { ...d, plays: { sport: 'nba', items: [...plays, early] } };
    expect(detectNbaMoments(d2).some((e) => e.type === 'buzzer_beater')).toBe(false);
    // A basket that leaves the shooter's side behind is not one either.
    const late = { ...winner, homeScore: 115, awayScore: 117 };
    const d3: CanonicalGameDetail = {
      ...d,
      homeScore: 115,
      plays: { sport: 'nba', items: [...plays, late] },
    };
    expect(detectNbaMoments(d3).some((e) => e.type === 'buzzer_beater')).toBe(false);
  });
  it('a 20-point comeback belongs to the winner and names nobody', () => {
    const plays = base.plays.sport === 'nba' ? base.plays.items : [];
    const down = plays.map((p, i) => (i === 10 ? { ...p, homeScore: 0, awayScore: 22 } : p));
    const d: CanonicalGameDetail = {
      ...base,
      homeScore: 116,
      awayScore: 100,
      plays: { sport: 'nba', items: down },
    };
    const cb = detectNbaMoments(d).find((e) => e.type === 'comeback_20');
    expect(cb?.side).toBe('home');
    expect(cb?.playerName).toBeNull();
    expect(cb?.detail['maxDeficit']).toBe(22);
  });
});

describe('win probability and the story', () => {
  const summary = load<EspnSummary>('espn_summary_401705733_2025_2026-09-17.json');
  const old = load<EspnSummary>('espn_summary_400899375_2016_2026-09-17.json');
  it('reads ESPN points joined to plays', () => {
    const points = parseEspnWinProbability(summary);
    expect(points.length).toBe(439);
    expect(points[0]!.homeWp).toBeCloseTo(0.473);
    expect(points[points.length - 1]!.homeWp).toBe(1);
    expect(points[0]!.period).toBe(1);
    expect(points[0]!.occurredAt).toBe('2025-04-10T23:11:13.000Z');
    expect(parseEspnWinProbability(old)).toHaveLength(0);
  });
  it('the model is even at tip, certain at the buzzer, and leans with the prior', () => {
    expect(modelHomeWp(0, 2880)).toBeCloseTo(0.5);
    expect(modelHomeWp(0, 2880, 0.7)).toBeCloseTo(0.7, 1);
    expect(modelHomeWp(10, 0)).toBe(1);
    expect(modelHomeWp(-1, 0)).toBe(0);
    expect(modelHomeWp(10, 60)).toBeGreaterThan(modelHomeWp(10, 1500));
    expect(modelHomeWp(-10, 60)).toBeLessThan(0.1);
  });
  it('the step rule keeps lead changes, ties, period ends, the last three minutes and the final', () => {
    const box = load<CdnBoxscore>('cdn_boxscore_0022400001_2026-09-17.json');
    const pbp = load<CdnPlayByPlay>('cdn_playbyplay_0022400001_2026-09-17.json');
    const detail = parseCdnDetail(box, pbp, {
      providerGameId: '0022400001',
      scheduledStart: '2024-11-13T00:00:00Z',
      providerVenueId: null,
      venueName: null,
      isNeutralSite: false,
    });
    const kept = selectStepRows(detail.timeline);
    expect(kept.length).toBeLessThanOrEqual(MAX_STEPS);
    expect(kept.length).toBeGreaterThan(10);
    expect(kept[kept.length - 1]!.event).toBe(detail.timeline[detail.timeline.length - 1]);
    // Every score in the last three minutes of the fourth is there.
    const late = detail.timeline.filter(
      (e) => e.period === 4 && (clockToSeconds(e.clock) ?? 999) <= 180,
    );
    for (const e of late) expect(kept.some((k) => k.event === e)).toBe(true);
    const reasons = new Set(kept.map((k) => k.reason));
    expect(reasons.has('late')).toBe(true);
    expect(reasons.has('final_score')).toBe(true);
    const points = modelWinProbability(detail.timeline, 0.55);
    expect(points.length).toBe(detail.timeline.length + 2);
    expect(points[points.length - 1]!.homeWp).toBe(0);
    const steps = buildNbaStorySteps(
      detail.timeline,
      points,
      { awayScore: 117, homeScore: 116, awayName: 'Atlanta Hawks', homeName: 'Boston Celtics' },
      modelPointFinder(points),
    );
    expect(steps[0]!.label).toBe('Pregame');
    expect(steps[0]!.text).toContain('Boston Celtics were 55% to win at tip-off.');
    expect(steps[steps.length - 1]!.text).toBe('Atlanta Hawks win 117–116.');
    expect(steps[1]!.label).toBe('1st quarter');
    expect(steps.every((s) => s.wpSeq >= 1 && s.wpSeq <= points.length)).toBe(true);
    expect(steps.length).toBe(kept.length + 2);
  });
  it('ESPN points are found by score, moving forward', () => {
    const points = parseEspnWinProbability(summary);
    const find = espnPointFinder(points);
    const seq = find({
      seq: 1,
      occurredAt: null,
      period: 1,
      half: null,
      clock: '11:37',
      homeScore: 2,
      awayScore: 0,
      scoringSide: 'home',
      description: '',
    });
    expect(points.find((p) => p.seq === seq)?.homeScore).toBe(2);
  });
});

describe('live state, rosters, scoring copy, Elo, highlights', () => {
  it('reads the scoreboard into the pledge countdown', () => {
    const live = parseCdnLiveState(
      {
        gameId: '0022600001',
        gameStatus: 2,
        gameStatusText: 'Q2 5:31',
        period: 2,
        gameClock: 'PT05M31.00S',
        gameTimeUTC: '',
        homeTeam: { teamId: 1, teamTricode: 'BOS', score: 40 },
        awayTeam: { teamId: 2, teamTricode: 'NYK', score: 38 },
      },
      '2026-10-22T00:30:00Z',
    );
    expect(live).toMatchObject({
      status: 'live',
      inning: 2,
      inningState: 'live',
      clock: '5:31',
      homeScore: 40,
      awayScore: 38,
    });
    const half = parseCdnLiveState(
      {
        gameId: 'x',
        gameStatus: 2,
        gameStatusText: 'Halftime',
        period: 2,
        gameClock: 'PT00M00.00S',
        gameTimeUTC: '',
        homeTeam: { teamId: 1, teamTricode: 'A', score: 50 },
        awayTeam: { teamId: 2, teamTricode: 'B', score: 50 },
      },
      'now',
    );
    expect(half.inningState).toBe('halftime');
    const endQ1 = parseCdnLiveState(
      {
        gameId: 'x',
        gameStatus: 2,
        gameStatusText: 'End of 1st Qtr',
        period: 1,
        gameClock: 'PT00M00.00S',
        gameTimeUTC: '',
        homeTeam: { teamId: 1, teamTricode: 'A', score: 30 },
        awayTeam: { teamId: 2, teamTricode: 'B', score: 28 },
      },
      '2026-10-22T00:40:00Z',
    );
    expect(endQ1.inningState).toBe('end');
    // The estimate: not locked by a score, locked at the end of the first.
    const start = '2026-10-22T00:00:00Z';
    expect(
      estimatedLock(
        'nba',
        start,
        {
          ...live,
          fetchedAt: '2026-10-22T00:10:00Z',
          inning: 1,
          inningState: 'live',
          homeScore: 5,
          awayScore: 2,
        },
        '2026-10-22T00:10:00Z',
      ).locked,
    ).toBe(false);
    expect(estimatedLock('nba', start, endQ1, '2026-10-22T00:40:00Z')).toMatchObject({
      locked: true,
      reason: 'end_of_first',
    });
    expect(estimatedLock('nba', start, null, '2026-10-22T00:10:00Z')).toMatchObject({
      locked: false,
      at: '2026-10-22T00:30:00.000Z',
    });
    expect(estimatedLock('nba', start, null, '2026-10-22T00:31:00Z').locked).toBe(true);
  });
  it('parses a roster', () => {
    const roster = parseNbaRoster(
      load<StatsResponse>('stats_commonteamroster_PHI_2025-26_2026-09-17.json'),
    );
    expect(roster.length).toBe(17);
    const maxey = roster.find((r) => r.fullName === 'Tyrese Maxey')!;
    expect(maxey).toMatchObject({
      providerPlayerId: '1630178',
      position: 'G',
      jersey: '0',
      status: null,
    });
  });
  it('says who scored, basketball style', () => {
    expect(
      scoringNote({
        sport: 'nba',
        kind: 'three',
        scorerName: 'Stephen Curry',
        description: 'x',
        runs: 3,
      }),
    ).toBe('Three, Stephen Curry');
    expect(
      scoringNote({
        sport: 'nba',
        kind: 'dunk',
        scorerName: 'Anthony Edwards',
        description: 'x',
        runs: 2,
      }),
    ).toBe('Dunk, Anthony Edwards');
    expect(
      scoringNote({
        sport: 'nba',
        kind: 'and_one',
        scorerName: 'LeBron James',
        description: 'x',
        runs: 1,
      }),
    ).toBe('And-one, LeBron James');
    expect(
      scoringNote({
        sport: 'nba',
        kind: 'free_throw',
        scorerName: 'Joel Embiid',
        description: 'J. Embiid Free Throw 2 of 2',
        runs: 1,
      }),
    ).toBe('Free throw 2 of 2, Joel Embiid');
    expect(scoringWhen('nba', 3, null, '04:12')).toBe('Q3 4:12');
    expect(scoringWhen('nba', 5, null, '1:03')).toBe('OT 1:03');
    const rows = [
      {
        seq: 1,
        period: 1,
        half: null,
        clock: '10:50',
        homeScore: 0,
        awayScore: 2,
        scoringSide: 'away' as const,
        description: 'layup',
        kind: 'layup',
        scorerPlayerId: 'p1',
        scorerName: 'A Player',
      },
      {
        seq: 2,
        period: 1,
        half: null,
        clock: '10:50',
        homeScore: 0,
        awayScore: 3,
        scoringSide: 'away' as const,
        description: 'ft 1 of 1',
        kind: 'and_one',
        scorerPlayerId: 'p1',
        scorerName: 'A Player',
      },
      {
        seq: 3,
        period: 1,
        half: null,
        clock: '9:44',
        homeScore: 0,
        awayScore: 4,
        scoringSide: 'away' as const,
        description: 'Free Throw 1 of 2',
        kind: 'free_throw',
        scorerPlayerId: 'p2',
        scorerName: 'B Player',
      },
      {
        seq: 4,
        period: 1,
        half: null,
        clock: '9:44',
        homeScore: 0,
        awayScore: 5,
        scoringSide: 'away' as const,
        description: 'Free Throw 2 of 2',
        kind: 'free_throw',
        scorerPlayerId: 'p2',
        scorerName: 'B Player',
      },
    ];
    const lines = scoringLines('nba', rows);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      note: 'Layup, A Player',
      suffix: 'And-one',
      awayScore: 3,
      folded: [2],
    });
    expect(lines[1]).toMatchObject({
      note: 'Free throws, B Player',
      suffix: '2 of 2',
      awayScore: 5,
      folded: [4],
    });
  });
  it('has Elo parameters and a highlights page', () => {
    expect(ELO_PARAMS.nba).toMatchObject({ k: 8, homeAdv: 50, movMultiplier: true });
    expect(
      officialHighlightsUrl({
        sport: 'nba',
        providerGameId: '0022400001',
        season: 2024,
        gameType: 'regular',
        awayNickname: 'Hawks',
        homeNickname: 'Celtics',
      }),
    ).toBe('https://www.nba.com/game/0022400001');
    expect(
      officialHighlightsUrl({
        sport: 'nba',
        providerGameId: null,
        season: 2024,
        gameType: 'regular',
        awayNickname: null,
        homeNickname: null,
      }),
    ).toBe('https://www.nba.com/watch/');
    expect(highlightsSiteLabel('nba')).toBe('Opens on NBA.com');
  });
});
