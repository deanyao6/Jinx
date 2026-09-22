import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { detectMlbMoments, detectNoHitter, detectWalkOff } from './moments.js';
import {
  mapMlbStatus,
  parseMlbFeed,
  parseMlbLiveState,
  parseMlbSchedule,
  parseMlbTeams,
  type MlbFeed,
  type MlbScheduleResponse,
  type MlbTeamsResponse,
  mlbScheduleFinalAt,
  mlbBoxLine,
  inningsToOuts,
  type MlbScheduleGame,
} from './parse.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '../../../../../ingest/fixtures/mlb');

function load<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixtures, name), 'utf8')) as T;
}

const feeds = {
  balDet: () => load<MlbFeed>('feed_746419_BAL_DET_2024-09-15.json'),
  noHitter: () => load<MlbFeed>('feed_746679_SF_CIN_nohitter_2024-08-02.json'),
  walkOffSlam: () => load<MlbFeed>('feed_775300_NYY_LAD_WS1_walkoff_slam_2024-10-25.json'),
  rickwood: () => load<MlbFeed>('feed_745164_SF_STL_rickwood_2024-06-20.json'),
  dh1: () => load<MlbFeed>('feed_745844_DET_NYM_DH1_2024-04-04.json'),
  dh2: () => load<MlbFeed>('feed_745843_DET_NYM_DH2_2024-04-04.json'),
};

describe('parseMlbSchedule', () => {
  it('parses a day of finals', () => {
    const games = parseMlbSchedule(load<MlbScheduleResponse>('schedule_2024-09-15.json'));
    expect(games).toHaveLength(15);
    const g = games.find((x) => x.providerGameId === '746419');
    expect(g).toMatchObject({
      sport: 'mlb',
      season: 2024,
      gameType: 'regular',
      status: 'final',
      homeProviderTeamId: '116',
      awayProviderTeamId: '110',
      homeScore: 4,
      awayScore: 2,
      isTie: false,
      doubleheaderNumber: null,
      venueName: 'Comerica Park',
      scheduledStart: '2024-09-15T16:10:00Z',
    });
  });

  it('marks postponed games and links makeups', () => {
    const games = parseMlbSchedule(load<MlbScheduleResponse>('schedule_2024-03-28_postponed.json'));
    const postponed = games.filter((g) => g.status === 'postponed');
    expect(postponed.length).toBeGreaterThan(0);
    for (const p of postponed) {
      expect(p.homeScore).toBeNull();
      expect(p.isTie).toBe(false);
    }
  });

  it('flags neutral sites when the home venue map is supplied', () => {
    const games = parseMlbSchedule(load<MlbScheduleResponse>('schedule_2024-09-15.json'), {
      homeVenueIdByTeamId: { '116': 9999 },
    });
    expect(games.find((x) => x.providerGameId === '746419')?.isNeutralSite).toBe(true);
    expect(games.find((x) => x.providerGameId === '745530')?.isNeutralSite).toBe(false);
  });

  it('maps statuses', () => {
    expect(mapMlbStatus({ abstractGameState: 'Final', detailedState: 'Postponed' })).toBe(
      'postponed',
    );
    expect(mapMlbStatus({ abstractGameState: 'Final', detailedState: 'Completed Early' })).toBe(
      'final',
    );
    expect(mapMlbStatus({ abstractGameState: 'Live', detailedState: 'In Progress' })).toBe('live');
    expect(mapMlbStatus({ abstractGameState: 'Preview', detailedState: 'Scheduled' })).toBe(
      'scheduled',
    );
    expect(mapMlbStatus({ abstractGameState: 'Final', detailedState: 'Cancelled' })).toBe(
      'cancelled',
    );
    expect(mapMlbStatus({ abstractGameState: 'Live', detailedState: 'Suspended: Rain' })).toBe(
      'suspended',
    );
  });
});

describe('parseMlbTeams', () => {
  it('returns 30 teams with aliases', () => {
    const teams = parseMlbTeams(load<MlbTeamsResponse>('teams_2024.json'));
    expect(teams).toHaveLength(30);
    const phi = teams.find((t) => t.providerTeamId === '143');
    expect(phi?.name).toBe('Philadelphia Phillies');
    expect(phi?.aliases).toContain('PHI');
    expect(phi?.aliases).toContain('Phillies');
    expect(phi?.franchiseId).toBe('mlb-143');
  });
});

describe('parseMlbFeed', () => {
  it('parses score, context, appearances and timeline', () => {
    const d = parseMlbFeed(feeds.balDet());
    expect(d.status).toBe('final');
    expect(d.homeScore).toBe(4);
    expect(d.awayScore).toBe(2);
    expect(d.temperatureF).toBe(81);
    expect(d.durationMinutes).toBe(140);
    expect(d.attendance).toBe(20643);
    expect(d.inningsOrPeriods).toBe(9);
    expect(d.venueName).toBe('Comerica Park');
    expect(d.isNeutralSite).toBe(false);
    expect(d.appearances.length).toBeGreaterThan(20);
    expect(d.appearances.every((a) => a.fullName.length > 0)).toBe(true);
    expect(d.timeline).toHaveLength(4);
    expect(d.timeline[0]).toMatchObject({
      period: 3,
      half: 'bottom',
      scoringSide: 'home',
      homeScore: 2,
      awayScore: 0,
    });
    expect(d.timeline[0]?.occurredAt).toBe('2024-09-15T17:01:26.415Z');
    expect(d.timestampsReliable).toBe(true);
    expect(d.plays.sport).toBe('mlb');
    expect(d.plays.items.length).toBe(68);
    expect(d.hits).toEqual({ home: 5, away: 7 });
  });

  it('flags neutral sites from the feed', () => {
    const d = parseMlbFeed(feeds.rickwood());
    expect(d.venueName).toBe('Rickwood Field');
    expect(d.isNeutralSite).toBe(true);
  });

  it('parses doubleheader numbers', () => {
    expect(parseMlbFeed(feeds.dh1()).doubleheaderNumber).toBe(1);
    expect(parseMlbFeed(feeds.dh2()).doubleheaderNumber).toBe(2);
  });

  it('exposes a live state', () => {
    const s = parseMlbLiveState(feeds.balDet(), '2024-09-15T20:00:00Z');
    expect(s.status).toBe('final');
    expect(s.inning).toBe(9);
    expect(s.homeScore).toBe(4);
  });
});

describe('MLB moments', () => {
  it('detects a walk-off single', () => {
    const d = parseMlbFeed(feeds.dh2());
    const ev = detectWalkOff(d);
    expect(ev.map((e) => e.type)).toEqual(['walk_off']);
    expect(ev[0]?.side).toBe('home');
    expect(ev[0]?.detail).toMatchObject({ inning: 9, event: 'Single' });
  });

  it('detects a walk-off grand slam in extra innings', () => {
    const d = parseMlbFeed(feeds.walkOffSlam());
    const types = detectMlbMoments(d).map((e) => e.type);
    expect(types).toContain('walk_off');
    expect(types).toContain('walk_off_home_run');
    expect(types).toContain('grand_slam');
    expect(types).toContain('extra_innings');
    expect(types).toContain('home_run');
    const slam = detectMlbMoments(d).find((e) => e.type === 'grand_slam');
    expect(slam?.playerName).toBe('Freddie Freeman');
    expect(slam?.side).toBe('home');
  });

  it('detects a no-hitter and a shutout', () => {
    const d = parseMlbFeed(feeds.noHitter());
    const events = detectMlbMoments(d);
    const nh = events.find((e) => e.type === 'no_hitter');
    expect(nh?.side).toBe('away');
    expect(nh?.playerName).toBe('Blake Snell');
    expect(events.find((e) => e.type === 'perfect_game')).toBeUndefined();
    expect(events.find((e) => e.type === 'shutout')?.side).toBe('away');
    expect(events.find((e) => e.type === 'walk_off')).toBeUndefined();
  });

  it('does not fire game-level moments on an ordinary game', () => {
    const d = parseMlbFeed(feeds.balDet());
    const types = detectMlbMoments(d).map((e) => e.type);
    expect(types).not.toContain('walk_off');
    expect(types).not.toContain('no_hitter');
    expect(types).not.toContain('extra_innings');
    expect(types).not.toContain('shutout');
    expect(types.filter((t) => t === 'home_run').length).toBeGreaterThan(0);
  });

  it('does not call a rain-shortened or unfinished game a no-hitter', () => {
    const d = parseMlbFeed(feeds.noHitter());
    expect(detectNoHitter({ ...d, inningsOrPeriods: 6 })).toEqual([]);
    expect(detectNoHitter({ ...d, status: 'live' })).toEqual([]);
  });
});

describe('when a game ended, from the schedule (hydrate=gameInfo)', () => {
  const doc = load<{ games: MlbScheduleGame[] }>(
    'schedule_2026-09-16_gameInfo_no_end_time_2026-09-22.json',
  );
  it('is first pitch plus the duration: a 13-inning game and a 9-inning game, both undelayed', () => {
    const [nyyMin, miaAz] = doc.games;
    // Read against the feeds' last plays: 21:31:28Z and 04:31:27Z (docs/verification.md).
    expect(mlbScheduleFinalAt(nyyMin!)).toBe('2026-09-16T21:30:00.000Z');
    expect(mlbScheduleFinalAt(miaAz!)).toBe('2026-09-17T04:32:00.000Z');
  });
  it('adds back only the part of a delay that came after the first pitch', () => {
    const base = doc.games[0]!;
    // 822686 ATL@WSH: an 86-minute delay in the 4th; the last play ended 21:03:24Z.
    const midGame = {
      ...base,
      gameDate: '2026-09-02T17:05:00Z',
      gameInfo: { firstPitch: '2026-09-02T17:06:00.000Z', gameDurationMinutes: 151, delayDurationMinutes: 86 },
    };
    expect(mlbScheduleFinalAt(midGame)).toBe('2026-09-02T21:02:00.000Z');
    // 824424 DET@CLE: a 64-minute delay entirely before the first pitch; last play 21:56:44Z.
    const preGame = {
      ...base,
      gameDate: '2026-09-04T18:10:00Z',
      gameInfo: { firstPitch: '2026-09-04T19:14:00.000Z', gameDurationMinutes: 162, delayDurationMinutes: 64 },
    };
    expect(mlbScheduleFinalAt(preGame)).toBe('2026-09-04T21:56:00.000Z');
  });
  it('is null without gameInfo, and a schedule row without one never wipes a detail value', () => {
    const { gameInfo: _omit, ...withoutInfo } = doc.games[0]!;
    expect(mlbScheduleFinalAt(withoutInfo)).toBeNull();
  });
});

describe('box-score lines (players seen, decision 7)', () => {
  it('reads the Tigers\' box on 2024-09-15: Greene 2 HR 3 RBI, Montero 5 innings, Foley the save', () => {
    const detail = parseMlbFeed(feeds.balDet());
    const by = new Map(detail.appearances.map((a) => [a.fullName, a.line]));
    expect(by.get('Riley Greene')).toEqual({ ab: 4, h: 2, hr: 2, rbi: 3 });
    expect(by.get('Keider Montero')).toMatchObject({ pitched: true, ip_outs: 15, er: 0, k: 1, sv: 0 });
    expect(by.get('Jason Foley')).toMatchObject({ pitched: true, ip_outs: 4, sv: 1 });
    expect(inningsToOuts('7.0', undefined)).toBe(21);
    expect(inningsToOuts('6.2', undefined)).toBe(20);
    expect(inningsToOuts(undefined, 4)).toBe(4);
    expect(mlbBoxLine(undefined, false)).toBeNull();
  });
});
