import {
  checkInFailureCopy,
  distanceMeters,
  estimateLock,
  formatCountdown,
  isTodayAtVenue,
  isWithinCheckInWindow,
  lockRuleCopy,
  pledgeConfirmationCopy,
  underdogTeamId,
  type LiveState,
} from '../lock';

const START = '2026-09-15T23:05:00Z';
const t = (iso: string) => Date.parse(iso);

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters(39.906, -75.166, 39.906, -75.166)).toBe(0);
  });
  it('measures Citizens Bank Park to Lincoln Financial Field at roughly 700 m', () => {
    const d = distanceMeters(39.9061, -75.1665, 39.9008, -75.1675);
    expect(d).toBeGreaterThan(550);
    expect(d).toBeLessThan(700);
  });
  it('measures Philadelphia to New York at roughly 130 km', () => {
    const d = distanceMeters(39.9526, -75.1652, 40.7128, -74.006);
    expect(Math.round(d / 1000)).toBe(130);
  });
});

describe('estimateLock', () => {
  it('NFL: scheduled start + 12 minutes, estimated', () => {
    const lock = estimateLock('nfl', START, null, t('2026-09-15T23:10:00Z'));
    expect(lock.at).toBe('2026-09-15T23:17:00.000Z');
    expect(lock.locked).toBe(false);
    expect(lock.reason).toBe('estimate');
    expect(estimateLock('nfl', START, null, t('2026-09-15T23:17:00Z')).locked).toBe(true);
  });
  it('MLB without live data: scheduled start + 30 minutes', () => {
    const lock = estimateLock('mlb', START, null, t('2026-09-15T23:00:00Z'));
    expect(lock.at).toBe('2026-09-15T23:35:00.000Z');
    expect(lock.locked).toBe(false);
  });
  it('prefers the server estimate when given', () => {
    const lock = estimateLock(
      'mlb',
      START,
      null,
      t('2026-09-15T23:00:00Z'),
      '2026-09-15T23:40:00Z',
    );
    expect(lock.at).toBe('2026-09-15T23:40:00Z');
  });
  it('MLB locks immediately on the first run', () => {
    const live = {
      status: 'live',
      inning: 1,
      inning_state: 'top',
      home_score: 0,
      away_score: 1,
      locked: false,
      lock_reason: null,
      fetched_at: '2026-09-15T23:12:00Z',
    };
    const lock = estimateLock('mlb', START, live, t('2026-09-15T23:12:30Z'));
    expect(lock.locked).toBe(true);
    expect(lock.reason).toBe('first_score');
  });
  it('MLB locks at the end of the first', () => {
    const live = {
      status: 'live',
      inning: 1,
      inning_state: 'end',
      home_score: 0,
      away_score: 0,
      locked: false,
      lock_reason: null,
      fetched_at: '2026-09-15T23:25:00Z',
    };
    expect(estimateLock('mlb', START, live, t('2026-09-15T23:25:30Z')).reason).toBe('end_of_first');
  });
  it('MLB scoreless in the first keeps the fallback timer', () => {
    const live = {
      status: 'live',
      inning: 1,
      inning_state: 'bottom',
      home_score: 0,
      away_score: 0,
      locked: false,
      lock_reason: null,
      fetched_at: '2026-09-15T23:20:00Z',
    };
    const lock = estimateLock('mlb', START, live, t('2026-09-15T23:20:30Z'));
    expect(lock.locked).toBe(false);
    expect(lock.reason).toBe('live_fallback');
    expect(lock.at).toBe('2026-09-15T23:35:00.000Z');
  });
  it('honors the server locked flag', () => {
    const live = {
      status: 'live',
      inning: 1,
      inning_state: 'top',
      home_score: 0,
      away_score: 0,
      locked: true,
      lock_reason: 'first_score',
      fetched_at: '2026-09-15T23:12:00Z',
    };
    expect(estimateLock('mlb', START, live, t('2026-09-15T23:12:30Z')).locked).toBe(true);
  });
});

describe('countdown and copy', () => {
  it('formats minutes and seconds', () => {
    expect(formatCountdown('2026-09-15T23:35:00Z', t('2026-09-15T23:30:48Z'))).toBe('4:12');
    expect(formatCountdown('2026-09-16T01:35:00Z', t('2026-09-15T23:30:48Z'))).toBe('2:04:12');
  });
  it('says Locked at or past the target', () => {
    expect(formatCountdown('2026-09-15T23:35:00Z', t('2026-09-15T23:35:00Z'))).toBe('Locked');
    expect(formatCountdown('2026-09-15T23:35:00Z', t('2026-09-15T23:36:00Z'))).toBe('Locked');
  });
  it('uses the sport lock rule copy', () => {
    expect(lockRuleCopy('mlb')).toBe('Locks at the end of the 1st or the first run');
    expect(lockRuleCopy('nfl')).toBe('Locks at the first score or 10:00 left in Q1 (estimated)');
  });
  it('builds the confirmation sentence', () => {
    expect(pledgeConfirmationCopy('Bears', 0.38)).toBe(
      'Pledged to the Bears (38% to win). You can switch until it locks. A win here adds +0.62 to your record vs expected.',
    );
  });
  it('labels the underdog as the lower win probability', () => {
    expect(underdogTeamId({ team_id: 'h', win_prob: 0.62 }, { team_id: 'a', win_prob: 0.38 })).toBe(
      'a',
    );
    expect(underdogTeamId({ team_id: 'h', win_prob: null }, { team_id: 'a', win_prob: 0.4 })).toBe(
      null,
    );
  });
  it('explains a too-far check-in in plain words', () => {
    expect(checkInFailureCopy('too_far', { distance_m: 2400, venueName: 'Soldier Field' })).toBe(
      "You're about 1.5 mi from Soldier Field. Check in once you're inside.",
    );
  });
});

describe('windows and dates', () => {
  it('check-in window is 3 hours before to 6 hours after when no final', () => {
    expect(isWithinCheckInWindow(t('2026-09-15T20:05:00Z'), START, null)).toBe(true);
    expect(isWithinCheckInWindow(t('2026-09-15T20:04:59Z'), START, null)).toBe(false);
    expect(isWithinCheckInWindow(t('2026-09-16T05:05:00Z'), START, null)).toBe(true);
    expect(isWithinCheckInWindow(t('2026-09-15T19:00:00Z'), START, null)).toBe(false);
    expect(isWithinCheckInWindow(t('2026-09-16T05:06:00Z'), START, null)).toBe(false);
  });
  it('closes an hour after the final when known', () => {
    expect(isWithinCheckInWindow(t('2026-09-16T02:59:00Z'), START, '2026-09-16T02:00:00Z')).toBe(
      true,
    );
    expect(isWithinCheckInWindow(t('2026-09-16T03:01:00Z'), START, '2026-09-16T02:00:00Z')).toBe(
      false,
    );
  });
  it('uses the venue date, not UTC', () => {
    // 7:05 pm in Philadelphia on Sep 15 is 23:05 UTC. At 1am UTC Sep 16 it is still Sep 15 in Philly.
    expect(isTodayAtVenue(START, 'America/New_York', t('2026-09-16T01:00:00Z'))).toBe(true);
    expect(isTodayAtVenue(START, 'America/New_York', t('2026-09-16T05:00:00Z'))).toBe(false);
    expect(isTodayAtVenue(START, 'America/New_York', t('2026-09-15T10:00:00Z'))).toBe(true);
  });
});

describe('estimateLock for the sports the phone reads itself (2026-09-22)', () => {
  const start = '2026-10-21T23:30:00Z';
  const row = (over: Partial<LiveState>): LiveState => ({
    status: 'live',
    inning: 1,
    inning_state: 'live',
    home_score: 0,
    away_score: 0,
    locked: false,
    lock_reason: null,
    fetched_at: '2026-10-21T23:40:00Z',
    ...over,
  });
  it('NBA without a row: tip-off + 30 minutes, estimated', () => {
    const r = estimateLock('nba', start, null, Date.parse('2026-10-21T23:40:00Z'));
    expect(r).toEqual({ at: '2026-10-22T00:00:00.000Z', locked: false, reason: 'estimate' });
  });
  it('NBA: a first basket does not lock, the end of the first quarter does', () => {
    const now = Date.parse('2026-10-21T23:41:00Z');
    expect(estimateLock('nba', start, row({ home_score: 2 }), now).reason).toBe('live_fallback');
    expect(estimateLock('nba', start, row({ home_score: 2 }), now).locked).toBe(false);
    const end = estimateLock('nba', start, row({ inning: 1, inning_state: 'end', home_score: 28, away_score: 25 }), now);
    expect(end).toEqual({ at: '2026-10-21T23:40:00Z', locked: true, reason: 'end_of_first' });
    expect(estimateLock('nba', start, row({ inning: 2, inning_state: 'halftime' }), now).locked).toBe(true);
  });
  it('MLS without a row: kick-off + 15 minutes, estimated; a first goal or halftime locks', () => {
    const now = Date.parse('2026-10-21T23:41:00Z');
    expect(estimateLock('mls', start, null, now)).toEqual({
      at: '2026-10-21T23:45:00.000Z',
      locked: false,
      reason: 'estimate',
    });
    expect(estimateLock('mls', start, row({ away_score: 1 }), now)).toEqual({
      at: '2026-10-21T23:40:00Z',
      locked: true,
      reason: 'first_score',
    });
    expect(estimateLock('mls', start, row({ inning: 1, inning_state: 'halftime' }), now).locked).toBe(false);
    expect(estimateLock('mls', start, row({ inning: 2, inning_state: 'live' }), now).reason).toBe('end_of_first');
    expect(lockRuleCopy('mls')).toBe('Locks at the first goal or halftime');
  });
});
