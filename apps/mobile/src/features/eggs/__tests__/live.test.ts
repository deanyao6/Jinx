import {
  activeCheckIn,
  EGG_SPORTS,
  eggLiveFrom,
  hasLiveFeed,
  isStretchTime,
  liveIsFresh,
  rallyCapEligible,
  rallyCapShowing,
  rallyCapWorked,
  RALLY_CAP_MAX_MS,
  type CheckInCandidate,
  type EggLive,
} from '@/features/eggs/live';

const live = (over: Partial<EggLive> = {}): EggLive => ({
  status: 'live',
  period: 8,
  periodState: 'top',
  homeScore: 2,
  awayScore: 5,
  ...over,
});

describe('the sport table', () => {
  it('has a complete row for each sport, and only MLB has a live feed today', () => {
    expect(Object.keys(EGG_SPORTS).sort()).toEqual(['mlb', 'nba', 'nfl']);
    for (const row of Object.values(EGG_SPORTS)) {
      expect(row.lateFrom).toBeGreaterThan(0);
      expect(row.signatureBreak.periods.length).toBeGreaterThan(0);
      expect(row.signatureBreak.states.length).toBeGreaterThan(0);
      expect(row.pieces).toHaveLength(3);
    }
    expect(hasLiveFeed('mlb')).toBe(true);
    expect(hasLiveFeed('nfl')).toBe(false);
    expect(hasLiveFeed('nhl')).toBe(false);
    expect(hasLiveFeed(null)).toBe(false);
  });

  it('reads a game_live_state row without the baseball words', () => {
    expect(
      eggLiveFrom({
        status: 'live',
        inning: 7,
        inning_state: 'Middle',
        home_score: 1,
        away_score: 0,
      }),
    ).toEqual({ status: 'live', period: 7, periodState: 'middle', homeScore: 1, awayScore: 0 });
    expect(eggLiveFrom(null)).toBeNull();
  });
});

describe('rallyCapEligible', () => {
  it('is on when the side is behind, late, in a live game', () => {
    expect(rallyCapEligible({ sport: 'mlb', live: live(), rootingSide: 'home' })).toBe(true);
    expect(rallyCapEligible({ sport: 'mlb', live: live({ period: 7 }), rootingSide: 'home' })).toBe(
      true,
    );
    expect(
      rallyCapEligible({ sport: 'mlb', live: live({ period: 11 }), rootingSide: 'home' }),
    ).toBe(true);
  });

  it('is off when it is not late yet', () => {
    expect(rallyCapEligible({ sport: 'mlb', live: live({ period: 6 }), rootingSide: 'home' })).toBe(
      false,
    );
    expect(
      rallyCapEligible({ sport: 'mlb', live: live({ period: null }), rootingSide: 'home' }),
    ).toBe(false);
  });

  it('is off when the side is ahead or level', () => {
    expect(rallyCapEligible({ sport: 'mlb', live: live(), rootingSide: 'away' })).toBe(false);
    expect(
      rallyCapEligible({ sport: 'mlb', live: live({ homeScore: 5 }), rootingSide: 'home' }),
    ).toBe(false);
  });

  it('is off for a neutral, with no live state, and when the game is not live', () => {
    expect(rallyCapEligible({ sport: 'mlb', live: live(), rootingSide: null })).toBe(false);
    expect(rallyCapEligible({ sport: 'mlb', live: null, rootingSide: 'home' })).toBe(false);
    expect(
      rallyCapEligible({ sport: 'mlb', live: live({ status: 'final' }), rootingSide: 'home' }),
    ).toBe(false);
  });

  it('is off for NFL today, and for a sport with no row', () => {
    const fourth = live({ period: 4 });
    expect(rallyCapEligible({ sport: 'nfl', live: fourth, rootingSide: 'home' })).toBe(false);
    expect(rallyCapEligible({ sport: 'nhl', live: fourth, rootingSide: 'home' })).toBe(false);
  });

  it('lights up for NFL the day its row says there is a live feed', () => {
    const nfl = EGG_SPORTS.nfl as { liveFeed: boolean };
    nfl.liveFeed = true;
    try {
      const at = (period: number) =>
        rallyCapEligible({ sport: 'nfl', live: live({ period }), rootingSide: 'home' });
      expect(at(3)).toBe(false);
      expect(at(4)).toBe(true);
      expect(
        isStretchTime({
          sport: 'nfl',
          live: live({ period: 2, periodState: 'two_minute_warning' }),
        }),
      ).toBe(true);
    } finally {
      nfl.liveFeed = false;
    }
  });
});

describe('isStretchTime', () => {
  it('is the middle of the seventh, and only that', () => {
    const at = (period: number | null, periodState: string | null, status = 'live') =>
      isStretchTime({ sport: 'mlb', live: live({ period, periodState, status }) });
    expect(at(7, 'middle')).toBe(true);
    expect(at(7, 'top')).toBe(false);
    expect(at(7, 'bottom')).toBe(false);
    expect(at(7, 'end')).toBe(false);
    expect(at(6, 'middle')).toBe(false);
    expect(at(8, 'middle')).toBe(false);
    expect(at(7, null)).toBe(false);
    expect(at(null, 'middle')).toBe(false);
    expect(at(7, 'middle', 'final')).toBe(false);
  });

  it('is never true without live state, for NFL today, or for an unknown sport', () => {
    expect(isStretchTime({ sport: 'mlb', live: null })).toBe(false);
    const warning = live({ period: 4, periodState: 'two_minute_warning' });
    expect(isStretchTime({ sport: 'nfl', live: warning })).toBe(false);
    expect(isStretchTime({ sport: 'nhl', live: warning })).toBe(false);
  });

  it('only trusts a row fetched in the last few minutes', () => {
    const now = Date.UTC(2026, 8, 17, 2, 0);
    expect(liveIsFresh(new Date(now - 60_000).toISOString(), now)).toBe(true);
    expect(liveIsFresh(new Date(now + 30_000).toISOString(), now)).toBe(true);
    expect(liveIsFresh(new Date(now - 10 * 60_000).toISOString(), now)).toBe(false);
    expect(liveIsFresh(null, now)).toBe(false);
    expect(liveIsFresh('not a date', now)).toBe(false);
  });
});

describe('activeCheckIn', () => {
  const start = Date.UTC(2026, 8, 17, 23, 5);
  const HOUR = 60 * 60 * 1000;
  const row = (
    over: Partial<CheckInCandidate> = {},
    game: Partial<CheckInCandidate['game']> = {},
  ) =>
    ({
      verified_via: 'checkin',
      rooting_team_id: 'phi',
      ...over,
      game: {
        id: 'g1',
        sport_id: 'mlb',
        status: 'live',
        scheduled_start: new Date(start).toISOString(),
        home_team_id: 'lad',
        away_team_id: 'phi',
        ...game,
      },
    }) satisfies CheckInCandidate;

  it('finds the game the person is checked in to, and which side they are on', () => {
    expect(activeCheckIn([row()], start + HOUR)).toEqual({
      gameId: 'g1',
      sport: 'mlb',
      rootingTeamId: 'phi',
      rootingSide: 'away',
    });
  });

  it('has no side for a neutral, or for a side that is not playing', () => {
    expect(activeCheckIn([row({ rooting_team_id: null })], start)?.rootingSide).toBeNull();
    expect(activeCheckIn([row({ rooting_team_id: 'nym' })], start)).toMatchObject({
      rootingSide: null,
      rootingTeamId: null,
    });
  });

  it('ignores games that were only logged, that are over, or that are long past', () => {
    expect(activeCheckIn([row({ verified_via: null })], start)).toBeNull();
    expect(activeCheckIn([row({ verified_via: 'ticket' })], start)).toBeNull();
    expect(activeCheckIn([row({}, { status: 'final' })], start)).toBeNull();
    expect(activeCheckIn([row({}, { status: 'postponed' })], start)).toBeNull();
    expect(activeCheckIn([row()], start + 7 * HOUR)).toBeNull();
    expect(activeCheckIn([], start)).toBeNull();
    expect(activeCheckIn(undefined, start)).toBeNull();
  });

  it('counts a checked-in game the table still calls scheduled, before first pitch too', () => {
    expect(activeCheckIn([row({}, { status: 'scheduled' })], start - 2 * HOUR)?.gameId).toBe('g1');
  });

  it('takes the later game of a doubleheader', () => {
    const second = row({}, { id: 'g2', scheduled_start: new Date(start + 4 * HOUR).toISOString() });
    expect(activeCheckIn([row(), second], start + 5 * HOUR)?.gameId).toBe('g2');
  });
});

describe('the cap, once flipped', () => {
  const cap = { teamId: 'phi', at: 1_000_000 };

  it('stays on until the game is final', () => {
    expect(rallyCapShowing(cap, 'live', cap.at + 1000)).toBe(true);
    expect(rallyCapShowing(cap, 'scheduled', cap.at + 1000)).toBe(true);
    expect(rallyCapShowing(cap, undefined, cap.at + 1000)).toBe(true);
    expect(rallyCapShowing(cap, 'final', cap.at + 1000)).toBe(false);
    expect(rallyCapShowing(cap, 'suspended', cap.at + 1000)).toBe(false);
    expect(rallyCapShowing(null, 'live', cap.at)).toBe(false);
  });

  it('comes off by itself if the final never arrives', () => {
    expect(rallyCapShowing(cap, 'live', cap.at + RALLY_CAP_MAX_MS)).toBe(false);
  });

  it('worked only when the side it was flipped for won', () => {
    expect(rallyCapWorked(cap, 'phi')).toBe(true);
    expect(rallyCapWorked(cap, 'lad')).toBe(false);
    expect(rallyCapWorked(cap, null)).toBe(false);
    expect(rallyCapWorked(undefined, 'phi')).toBe(false);
  });
});
