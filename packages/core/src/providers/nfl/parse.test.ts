import { describe, expect, it } from 'vitest';
import { easternToUtcIso, isEasternDaylightTime } from './eastern.js';
import {
  FIXTURE_GAME_IDS,
  loadDetail,
  loadGameRow,
  loadPbpRows,
  nflPlays,
} from './fixtures.test-helpers.js';
import { mapGameType, parseNflGame } from './parse.js';
import type { NflversePbpRow } from './rows.js';

describe('easternToUtcIso', () => {
  it('converts Eastern daylight time (UTC-4)', () => {
    expect(easternToUtcIso('2024-09-29', '13:00')).toBe('2024-09-29T17:00:00.000Z');
    expect(easternToUtcIso('2024-09-05', '20:20')).toBe('2024-09-06T00:20:00.000Z');
  });

  it('converts Eastern standard time (UTC-5)', () => {
    expect(easternToUtcIso('2024-11-24', '13:00')).toBe('2024-11-24T18:00:00.000Z');
    expect(easternToUtcIso('2025-01-05', '16:25')).toBe('2025-01-05T21:25:00.000Z');
  });

  it('handles the November fall-back boundary (first Sunday of November)', () => {
    // Last Sunday on daylight time.
    expect(easternToUtcIso('2024-10-27', '13:00')).toBe('2024-10-27T17:00:00.000Z');
    // Switch day itself: 13:00 is after the 02:00 change, so standard time.
    expect(easternToUtcIso('2024-11-03', '13:00')).toBe('2024-11-03T18:00:00.000Z');
    // Before 02:00 on the switch day is still daylight time.
    expect(easternToUtcIso('2024-11-03', '01:30')).toBe('2024-11-03T05:30:00.000Z');
    // 2025: first Sunday is Nov 2.
    expect(easternToUtcIso('2025-11-02', '13:00')).toBe('2025-11-02T18:00:00.000Z');
    expect(easternToUtcIso('2025-10-26', '13:00')).toBe('2025-10-26T17:00:00.000Z');
  });

  it('handles the March spring-forward boundary (second Sunday of March)', () => {
    expect(easternToUtcIso('2024-03-09', '13:00')).toBe('2024-03-09T18:00:00.000Z');
    expect(easternToUtcIso('2024-03-10', '13:00')).toBe('2024-03-10T17:00:00.000Z');
    expect(easternToUtcIso('2024-03-10', '03:00')).toBe('2024-03-10T07:00:00.000Z');
    expect(easternToUtcIso('2025-03-09', '13:00')).toBe('2025-03-09T17:00:00.000Z');
  });

  it('rolls a Monday night kickoff into the next UTC day', () => {
    // Monday Nov 4 2024 (standard time, day after the switch).
    expect(easternToUtcIso('2024-11-04', '20:15')).toBe('2024-11-05T01:15:00.000Z');
    // Monday Sep 16 2024 (daylight time).
    expect(easternToUtcIso('2024-09-16', '20:15')).toBe('2024-09-17T00:15:00.000Z');
  });

  it('rejects malformed input', () => {
    expect(() => easternToUtcIso('2024-9-1', '13:00')).toThrow();
    expect(() => easternToUtcIso('2024-09-01', '1pm')).toThrow();
  });

  it('exposes the DST predicate', () => {
    expect(isEasternDaylightTime(Date.UTC(2024, 6, 4, 12))).toBe(true);
    expect(isEasternDaylightTime(Date.UTC(2024, 0, 4, 12))).toBe(false);
  });
});

describe('mapGameType', () => {
  it('maps nflverse game_type codes', () => {
    expect(mapGameType('REG')).toBe('regular');
    for (const code of ['WC', 'DIV', 'CON', 'SB']) expect(mapGameType(code)).toBe('postseason');
    expect(mapGameType('PRE')).toBe('preseason');
    expect(mapGameType(null)).toBe('preseason');
  });
});

describe('parseNflGame with 2024 fixtures', () => {
  it('produces the expected header fields for every fixture', () => {
    const expected = {
      '2024_12_TEN_HOU': {
        start: '2024-11-24T18:00:00.000Z',
        home: 'HOU',
        away: 'TEN',
        homeScore: 27,
        awayScore: 32,
        venueId: 'HOU00',
        venue: 'NRG Stadium',
        temp: null,
        periods: 4,
        timelineLength: 18,
        playCount: 175,
      },
      '2024_04_NO_ATL': {
        start: '2024-09-29T17:00:00.000Z',
        home: 'ATL',
        away: 'NO',
        homeScore: 26,
        awayScore: 24,
        venueId: 'ATL97',
        venue: 'Mercedes-Benz Stadium',
        temp: null,
        periods: 4,
        timelineLength: 15,
        playCount: 169,
      },
      '2024_05_BAL_CIN': {
        start: '2024-10-06T17:00:00.000Z',
        home: 'CIN',
        away: 'BAL',
        homeScore: 38,
        awayScore: 41,
        venueId: 'CIN00',
        venue: 'Paycor Stadium',
        temp: 81,
        periods: 5,
        timelineLength: 23,
        playCount: 196,
      },
      '2024_10_DET_HOU': {
        start: '2024-11-11T01:20:00.000Z',
        home: 'HOU',
        away: 'DET',
        homeScore: 23,
        awayScore: 26,
        venueId: 'HOU00',
        venue: 'NRG Stadium',
        temp: null,
        periods: 4,
        timelineLength: 14,
        playCount: 174,
      },
      '2024_06_TB_NO': {
        start: '2024-10-13T17:00:00.000Z',
        home: 'NO',
        away: 'TB',
        homeScore: 27,
        awayScore: 51,
        venueId: 'NOR00',
        venue: 'Mercedes-Benz Superdome',
        temp: null,
        periods: 4,
        timelineLength: 22,
        playCount: 193,
      },
    } as const;

    for (const gameId of FIXTURE_GAME_IDS) {
      const want = expected[gameId];
      const detail = loadDetail(gameId);
      expect(detail.provider).toBe('nflverse');
      expect(detail.providerGameId).toBe(gameId);
      expect(detail.sport).toBe('nfl');
      expect(detail.season).toBe(2024);
      expect(detail.gameType).toBe('regular');
      expect(detail.scheduledStart).toBe(want.start);
      expect(detail.homeProviderTeamId).toBe(want.home);
      expect(detail.awayProviderTeamId).toBe(want.away);
      expect(detail.status).toBe('final');
      expect(detail.homeScore).toBe(want.homeScore);
      expect(detail.awayScore).toBe(want.awayScore);
      expect(detail.isTie).toBe(false);
      expect(detail.isNeutralSite).toBe(false);
      expect(detail.doubleheaderNumber).toBeNull();
      expect(detail.rescheduledFromProviderGameId).toBeNull();
      expect(detail.rescheduledToProviderGameId).toBeNull();
      expect(detail.finalAt).toBeNull();
      expect(detail.providerVenueId).toBe(want.venueId);
      expect(detail.venueName).toBe(want.venue);
      expect(detail.temperatureF).toBe(want.temp);
      expect(detail.durationMinutes).toBeNull();
      expect(detail.attendance).toBeNull();
      expect(detail.inningsOrPeriods).toBe(want.periods);
      expect(detail.appearances).toEqual([]);
      expect(detail.timeline).toHaveLength(want.timelineLength);
      expect(detail.timestampsReliable).toBe(true);
      expect(detail.plays.sport).toBe('nfl');
      expect(detail.plays.items).toHaveLength(want.playCount);
    }
  });

  it('drops GAME / END QUARTER / END GAME marker rows but keeps everything else', () => {
    const rows = loadPbpRows('2024_05_BAL_CIN');
    const detail = loadDetail('2024_05_BAL_CIN');
    const markers = rows.filter((r) => r.play_type == null);
    expect(markers).toHaveLength(6); // GAME, END QUARTER 1-4, END GAME
    expect(detail.plays.items).toHaveLength(rows.length - markers.length);
    expect(nflPlays(detail).every((p) => p.playType != null)).toBe(true);
  });

  it('sorts plays by order_sequence regardless of input order', () => {
    const rows = [...loadPbpRows('2024_10_DET_HOU')].reverse();
    const detail = parseNflGame(loadGameRow('2024_10_DET_HOU'), rows);
    const orders = nflPlays(detail).map((p) => p.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(nflPlays(detail)[0]?.playType).toBe('kickoff');
    expect(detail.timeline[0]?.description).toContain('J.Mixon left end for 8 yards, TOUCHDOWN');
  });

  it('maps play fields (possession side, touchdown side, flags, clock, kick distance)', () => {
    const detail = loadDetail('2024_12_TEN_HOU');
    const items = nflPlays(detail);

    const pickSix = items.find((p) => p.interception && p.returnTouchdown);
    expect(pickSix).toBeDefined();
    expect(pickSix?.qtr).toBe(3);
    expect(pickSix?.clock).toBe('00:15');
    expect(pickSix?.quarterSecondsRemaining).toBe(15);
    expect(pickSix?.posSide).toBe('away'); // TEN had the ball
    expect(pickSix?.tdSide).toBe('home'); // HOU scored
    expect(pickSix?.touchdown).toBe(true);
    expect(pickSix?.isScoringPlay).toBe(true);
    expect(pickSix?.homeScore).toBe(23);
    expect(pickSix?.awayScore).toBe(23);
    expect(pickSix?.timeOfDay).toBe('2024-11-24T20:14:57Z');

    const safety = items.find((p) => p.safety);
    expect(safety?.qtr).toBe(4);
    expect(safety?.clock).toBe('01:17');
    expect(safety?.posSide).toBe('home');
    expect(safety?.tdSide).toBeNull();

    const longFg = items.find((p) => p.fieldGoalResult === 'made' && p.kickDistance === 56);
    expect(longFg?.playType).toBe('field_goal');
    expect(longFg?.posSide).toBe('away');
    expect(longFg?.kickDistance).toBe(56);

    const kickoff = items[0];
    expect(kickoff?.kickoffAttempt).toBe(true);
    expect(kickoff?.puntAttempt).toBe(false);
    expect(kickoff?.extraPointAttempt).toBe(false);
    expect(kickoff?.twoPointAttempt).toBe(false);
    expect(kickoff?.fieldGoalResult).toBeNull();
    expect(kickoff?.kickDistance).toBe(64);
    expect(kickoff?.gameSecondsRemaining).toBe(3600);

    const twoPoint = nflPlays(loadDetail('2024_05_BAL_CIN')).find((p) => p.twoPointAttempt);
    expect(twoPoint?.description).toContain('TWO-POINT CONVERSION ATTEMPT');
    expect(twoPoint?.isScoringPlay).toBe(true);
  });

  it('builds the scoring timeline from running score changes', () => {
    const detail = loadDetail('2024_10_DET_HOU');
    const first = detail.timeline[0];
    expect(first).toMatchObject({
      seq: 1,
      period: 1,
      half: null,
      clock: '07:50',
      homeScore: 6,
      awayScore: 0,
      scoringSide: 'home',
      occurredAt: '2024-11-11T01:34:46Z',
    });
    const last = detail.timeline[detail.timeline.length - 1];
    expect(last).toMatchObject({
      seq: 14,
      period: 4,
      clock: '00:04',
      homeScore: 23,
      awayScore: 26,
      scoringSide: 'away',
      occurredAt: '2024-11-11T04:35:04Z',
    });
    expect(last?.description).toContain('52 yard field goal is GOOD');
    expect(detail.timeline.map((e) => e.seq)).toEqual(detail.timeline.map((_, i) => i + 1));
    // Overtime scoring lands in period 5.
    const ot = loadDetail('2024_05_BAL_CIN').timeline.at(-1);
    expect(ot?.period).toBe(5);
    expect(ot?.scoringSide).toBe('away');
    expect(ot).toMatchObject({ homeScore: 38, awayScore: 41 });
  });

  it('keeps a marker row when it carries a score change', () => {
    const rows = loadPbpRows('2024_12_TEN_HOU');
    const endGame = rows.find((r) => r.desc === 'END GAME');
    expect(endGame).toBeDefined();
    const mutated: NflversePbpRow[] = rows.map((r) =>
      r === endGame ? { ...r, total_home_score: (r.total_home_score ?? 0) + 3 } : r,
    );
    const detail = parseNflGame(loadGameRow('2024_12_TEN_HOU'), mutated);
    expect(detail.plays.items).toHaveLength(176);
    expect(detail.timeline).toHaveLength(19);
    expect(detail.timeline.at(-1)?.scoringSide).toBe('home');
  });

  it('marks timestamps unreliable when a scoring play lacks time_of_day', () => {
    const rows = loadPbpRows('2024_04_NO_ATL');
    const scoring = rows.find((r) => r.sp === 1);
    const mutated = rows.map((r) => (r === scoring ? { ...r, time_of_day: null } : r));
    const detail = parseNflGame(loadGameRow('2024_04_NO_ATL'), mutated);
    expect(detail.timestampsReliable).toBe(false);
    expect(detail.timeline.some((e) => e.occurredAt == null)).toBe(true);
  });

  it('marks timestamps unreliable when the Q1 10:00 lock play lacks time_of_day', () => {
    const rows = loadPbpRows('2024_04_NO_ATL');
    const lock = rows.find(
      (r) =>
        r.play_type != null &&
        r.qtr === 1 &&
        r.quarter_seconds_remaining != null &&
        r.quarter_seconds_remaining <= 600,
    );
    expect(lock?.time_of_day).toBe('2024-09-29T17:15:44.717Z');
    const mutated = rows.map((r) => (r === lock ? { ...r, time_of_day: null } : r));
    const detail = parseNflGame(loadGameRow('2024_04_NO_ATL'), mutated);
    expect(detail.timestampsReliable).toBe(false);
    // Scoring plays are all still timestamped.
    expect(detail.timeline.every((e) => e.occurredAt != null)).toBe(true);
  });

  it('handles an unplayed game (no scores, no plays)', () => {
    const row = { ...loadGameRow('2024_12_TEN_HOU'), home_score: null, away_score: null };
    const detail = parseNflGame(row, []);
    expect(detail.status).toBe('scheduled');
    expect(detail.homeScore).toBeNull();
    expect(detail.isTie).toBe(false);
    expect(detail.inningsOrPeriods).toBeNull();
    expect(detail.timeline).toEqual([]);
    expect(detail.plays.items).toEqual([]);
    expect(detail.timestampsReliable).toBe(false);
  });

  it('applies the 13:00 default when gametime is empty and handles neutral/postseason/tie', () => {
    const base = loadGameRow('2024_05_BAL_CIN');
    const detail = parseNflGame(
      {
        ...base,
        gametime: '',
        game_type: 'SB',
        location: 'Neutral',
        home_score: 20,
        away_score: 20,
        temp: null,
      },
      [],
    );
    expect(detail.scheduledStart).toBe('2024-10-06T17:00:00.000Z');
    expect(detail.gameType).toBe('postseason');
    expect(detail.isNeutralSite).toBe(true);
    expect(detail.isTie).toBe(true);
    expect(detail.status).toBe('final');
    expect(detail.temperatureF).toBeNull();

    const january = parseNflGame({ ...base, gameday: '2025-01-12', gametime: null }, []);
    expect(january.scheduledStart).toBe('2025-01-12T18:00:00.000Z');
  });

  it('treats 2000-2005 "09:00" kickoffs as 9 PM Eastern', () => {
    const base = loadGameRow('2024_05_BAL_CIN');
    const old = parseNflGame(
      { ...base, season: 2005, gameday: '2005-09-08', gametime: '09:00' },
      [],
    );
    expect(old.scheduledStart).toBe('2005-09-09T01:00:00.000Z');
    const modern = parseNflGame(
      { ...base, season: 2024, gameday: '2024-10-06', gametime: '09:00' },
      [],
    );
    expect(modern.scheduledStart).toBe('2024-10-06T13:00:00.000Z');
  });
});
