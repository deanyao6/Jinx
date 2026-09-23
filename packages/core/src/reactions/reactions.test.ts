import { describe, expect, it } from 'vitest';

import {
  crowdSignal,
  gameSlot,
  lateLabel,
  mlbEventCandidate,
  mlsCandidates,
  nbaCandidates,
  nflScoreCandidate,
  parseClock,
  playLabel,
  promptSlots,
  recipientDecision,
  relabelPrompt,
  scheduledPromptDecision,
  slotsCopy,
  toSnapshot,
  type LiveSnapshot,
  type MlbLivePlay,
  type MlbPlayContext,
} from './index.js';
import type { MlsPlay } from '../types.js';

const at = '2026-09-24T02:00:00Z';

function live(over: Partial<LiveSnapshot>): LiveSnapshot {
  return {
    status: 'live',
    period: 1,
    periodState: 'live',
    clockSeconds: null,
    homeScore: 0,
    awayScore: 0,
    homeWp: 0.5,
    fetchedAt: at,
    ...over,
  };
}

describe('the scheduled prompt window, keyed by sport', () => {
  it('MLB: waits through the 7th, fires at the start of the 8th, closes at the 9th', () => {
    expect(scheduledPromptDecision('mlb', live({ period: 6, periodState: 'bottom' }))).toEqual({ due: false, reason: 'not_yet' });
    expect(scheduledPromptDecision('mlb', live({ period: 7, periodState: 'top' }))).toEqual({ due: false, reason: 'waiting' });
    expect(scheduledPromptDecision('mlb', live({ period: 8, periodState: 'top' }))).toEqual({ due: true, reason: 'window_middle' });
    expect(scheduledPromptDecision('mlb', live({ period: 8, periodState: 'end' }))).toEqual({ due: true, reason: 'window_end' });
    expect(scheduledPromptDecision('mlb', live({ period: 9, periodState: 'top' }))).toEqual({ due: false, reason: 'over' });
  });

  it('NFL: the 4th quarter before the two-minute warning, at nine minutes left', () => {
    expect(scheduledPromptDecision('nfl', live({ period: 3, clockSeconds: 30 }))).toEqual({ due: false, reason: 'not_yet' });
    expect(scheduledPromptDecision('nfl', live({ period: 4, clockSeconds: 14 * 60 }))).toEqual({ due: false, reason: 'waiting' });
    expect(scheduledPromptDecision('nfl', live({ period: 4, clockSeconds: 8 * 60 + 59 }))).toEqual({ due: true, reason: 'window_middle' });
    expect(scheduledPromptDecision('nfl', live({ period: 4, clockSeconds: 119 }))).toEqual({ due: false, reason: 'over' });
    expect(scheduledPromptDecision('nfl', live({ period: 5, clockSeconds: 600 }))).toEqual({ due: false, reason: 'over' });
  });

  it('NBA: from the start of the 4th, at eight minutes left; MLS from the 70th, at the 80th', () => {
    expect(scheduledPromptDecision('nba', live({ period: 3, clockSeconds: 10 }))).toEqual({ due: false, reason: 'not_yet' });
    expect(scheduledPromptDecision('nba', live({ period: 4, clockSeconds: 11 * 60 }))).toEqual({ due: false, reason: 'waiting' });
    expect(scheduledPromptDecision('nba', live({ period: 4, clockSeconds: 7 * 60 }))).toEqual({ due: true, reason: 'window_middle' });
    expect(scheduledPromptDecision('nba', live({ period: 5, clockSeconds: 4 * 60 }))).toEqual({ due: true, reason: 'window_end' });
    expect(scheduledPromptDecision('mls', live({ period: 2, clockSeconds: 69 }))).toEqual({ due: false, reason: 'not_yet' });
    expect(scheduledPromptDecision('mls', live({ period: 2, clockSeconds: 74 }))).toEqual({ due: false, reason: 'waiting' });
    expect(scheduledPromptDecision('mls', live({ period: 2, clockSeconds: 81 }))).toEqual({ due: true, reason: 'window_middle' });
  });

  it('a blowout fires at the start of the window instead of skipping the prompt', () => {
    expect(scheduledPromptDecision('mlb', live({ period: 7, periodState: 'top', homeWp: 0.95 }))).toEqual({ due: true, reason: 'blowout' });
    expect(scheduledPromptDecision('nfl', live({ period: 4, clockSeconds: 14 * 60, homeWp: 0.04 }))).toEqual({ due: true, reason: 'blowout' });
    // Not before the window opens, blowout or not.
    expect(scheduledPromptDecision('nfl', live({ period: 3, clockSeconds: 60, homeWp: 0.99 }))).toEqual({ due: false, reason: 'not_yet' });
  });

  it('never for a final, a sport with no rule, or a game not yet under way', () => {
    expect(scheduledPromptDecision('mlb', live({ status: 'final', period: 9 }))).toEqual({ due: false, reason: 'over' });
    expect(scheduledPromptDecision('nhl', live({ period: 3 }))).toEqual({ due: false, reason: 'over' });
    expect(scheduledPromptDecision('mlb', live({ status: 'scheduled', period: null }))).toEqual({ due: false, reason: 'not_yet' });
  });

  it('labels a late capture from the two-minute window', () => {
    expect(lateLabel(90)).toBeNull();
    expect(lateLabel(120)).toBeNull();
    expect(lateLabel(4 * 60 + 10)).toBe('late by 4 min');
    expect(lateLabel(2 * 3600)).toBe('late by 2 h');
  });
});

function play(over: Partial<MlbLivePlay['result']> & { inning?: number; half?: 'top' | 'bottom'; wp?: number; ab?: number }): MlbLivePlay {
  const { inning = 8, half = 'bottom', wp = 50, ab = 60, ...result } = over;
  return {
    about: { inning, halfInning: half, atBatIndex: ab, isComplete: true },
    result: { eventType: 'single', description: 'A single.', rbi: 0, homeScore: 0, awayScore: 0, ...result },
    matchup: { batter: { id: 1, fullName: 'Bryce Harper' } },
    homeTeamWinProbability: wp,
  };
}

function ctx(over: Partial<MlbPlayContext> = {}): MlbPlayContext {
  return { homeBefore: 0, awayBefore: 0, homeWpBefore: 0.5, halfInningRunsBefore: 0, hits: { home: 5, away: 4 }, ...over };
}

describe('the MLB event whitelist and gate', () => {
  it('a solo home run, an RBI single and a sacrifice fly do not prompt', () => {
    expect(mlbEventCandidate(play({ eventType: 'home_run', rbi: 1, homeScore: 1, wp: 62, description: 'Harper homers (1).' }), ctx({ homeWpBefore: 0.5 }))).toBeNull();
    expect(mlbEventCandidate(play({ eventType: 'single', rbi: 1, homeScore: 1, wp: 70 }), ctx({ homeWpBefore: 0.5 }))).toBeNull();
    expect(mlbEventCandidate(play({ eventType: 'sac_fly', rbi: 1, homeScore: 1, wp: 70 }), ctx({ homeWpBefore: 0.5 }))).toBeNull();
  });

  it('a 3-run homer prompts the side that hit it, with the real description and its swing', () => {
    const c = mlbEventCandidate(
      play({ eventType: 'home_run', rbi: 3, homeScore: 3, awayScore: 2, wp: 78, description: 'Bryce Harper homers (23) on a fly ball to right field. Two score.' }),
      ctx({ awayBefore: 2, homeWpBefore: 0.4 }),
    );
    expect(c).toMatchObject({ rule: 'multi_run_home_run', audience: 'home', significance: 38, milestone: false, homeScore: 3, awayScore: 2, periodLabel: 'Bottom 8th' });
    expect(c?.label).toContain('Bryce Harper homers');
    expect(c?.key).toBe('mlb:ab:60');
  });

  it('a 3-run homer that barely moves the line still fails the gate', () => {
    expect(mlbEventCandidate(play({ eventType: 'home_run', rbi: 3, homeScore: 12, wp: 99.5 }), ctx({ homeBefore: 9, homeWpBefore: 0.99 }))).toBeNull();
  });

  it('a walk-off prompts everyone; so does a completed no-hitter or perfect game', () => {
    const wo = mlbEventCandidate(
      play({ eventType: 'single', rbi: 1, homeScore: 3, awayScore: 2, inning: 9, half: 'bottom', wp: 100 }),
      ctx({ homeBefore: 2, awayBefore: 2, homeWpBefore: 0.6, gameOver: true }),
    );
    expect(wo).toMatchObject({ rule: 'walk_off', audience: 'all', milestone: true, significance: 100 });
    const nh = mlbEventCandidate(
      play({ eventType: 'strikeout', homeScore: 4, awayScore: 0, inning: 9, half: 'top', wp: 100 }),
      ctx({ homeBefore: 4, homeWpBefore: 0.99, hits: { home: 7, away: 0 }, gameOver: true }),
    );
    expect(nh).toMatchObject({ rule: 'no_hitter', audience: 'all', milestone: true });
    const pg = mlbEventCandidate(
      play({ eventType: 'field_out', homeScore: 4, awayScore: 0, inning: 9, half: 'top', wp: 100 }),
      ctx({ homeBefore: 4, homeWpBefore: 0.99, hits: { home: 7, away: 0 }, perfectSoFar: { home: true, away: false }, gameOver: true }),
    );
    expect(pg?.rule).toBe('perfect_game');
  });

  it('a go-ahead solo shot in the 7th or later, a grand slam, a triple play, a 5-run inning', () => {
    expect(mlbEventCandidate(play({ eventType: 'home_run', rbi: 1, homeScore: 3, awayScore: 2, inning: 8, wp: 75 }), ctx({ homeBefore: 2, awayBefore: 2, homeWpBefore: 0.5 }))?.rule).toBe('late_go_ahead_home_run');
    expect(mlbEventCandidate(play({ eventType: 'home_run', rbi: 1, homeScore: 3, awayScore: 2, inning: 3, wp: 75 }), ctx({ homeBefore: 2, awayBefore: 2, homeWpBefore: 0.5 }))).toBeNull();
    expect(mlbEventCandidate(play({ eventType: 'home_run', rbi: 4, homeScore: 4, wp: 85 }), ctx({ homeWpBefore: 0.5 }))?.rule).toBe('grand_slam');
    expect(mlbEventCandidate(play({ eventType: 'triple_play', half: 'top', wp: 70 }), ctx({ homeWpBefore: 0.5 }))).toMatchObject({ rule: 'triple_play', audience: 'home' });
    expect(mlbEventCandidate(play({ eventType: 'double', rbi: 2, homeScore: 6, wp: 92 }), ctx({ homeBefore: 4, halfInningRunsBefore: 4, homeWpBefore: 0.7 }))?.rule).toBe('five_run_inning');
  });

  it('a milestone-list play prompts regardless of the swing', () => {
    expect(mlbEventCandidate(play({ eventType: 'single', wp: 51 }), ctx({ milestone: true }))).toMatchObject({ rule: 'milestone', significance: 100 });
  });
});

describe('the coarse live NFL rule', () => {
  const nfl = { homeName: 'Eagles', awayName: 'Rams', periodLabel: 'Q4 4:12' };
  it('a field goal and a short touchdown that do not swing the margin do not prompt', () => {
    const before = live({ period: 2, clockSeconds: 300, homeScore: 14, awayScore: 3 });
    expect(nflScoreCandidate(before, { ...before, homeScore: 17 }, nfl)).toBeNull();
    expect(nflScoreCandidate(before, { ...before, homeScore: 21 }, nfl)).toBeNull();
  });
  it('a go-ahead touchdown late prompts the side that scored', () => {
    const before = live({ period: 4, clockSeconds: 252, homeScore: 20, awayScore: 24 });
    const c = nflScoreCandidate(before, { ...before, clockSeconds: 240, homeScore: 27 }, nfl);
    expect(c).toMatchObject({ rule: 'go_ahead_score', label: 'Touchdown, Eagles', audience: 'home' });
    expect(c!.significance).toBeGreaterThanOrEqual(15);
  });
  it('a pick-six the board names prompts even without a lead change', () => {
    const before = live({ period: 3, clockSeconds: 500, homeScore: 14, awayScore: 10 });
    const c = nflScoreCandidate(before, { ...before, homeScore: 21 }, { ...nfl, lastPlay: { type: 'Interception Return Touchdown', text: 'C. DeJean 38 yd interception return' } });
    expect(c).toMatchObject({ rule: 'return_score', label: 'Touchdown, Eagles' });
    // The same score with a 21-7 lead already in hand barely moves the line: the gate keeps it out.
    const cruising = live({ period: 3, clockSeconds: 500, homeScore: 21, awayScore: 7 });
    expect(nflScoreCandidate(cruising, { ...cruising, homeScore: 28 }, { ...nfl, lastPlay: { type: 'Interception Return Touchdown' } })).toBeNull();
  });
});

describe('the NBA rules from the scoreboard', () => {
  const nba = { homeName: 'Lakers', awayName: 'Celtics', periodLabel: 'Q4 1:30', run: null };
  it('a go-ahead score inside the final two minutes', () => {
    const before = live({ period: 4, clockSeconds: 100, homeScore: 100, awayScore: 101 });
    const { candidate } = nbaCandidates(before, { ...before, clockSeconds: 88, homeScore: 102 }, nba);
    expect(candidate).toMatchObject({ rule: 'late_go_ahead_score', audience: 'home' });
  });
  it('a 15-0 run, once, carried across polls', () => {
    let run = null as ReturnType<typeof nbaCandidates>['run'];
    let prev = live({ period: 3, clockSeconds: 600, homeScore: 60, awayScore: 60 });
    let fired = 0;
    for (const pts of [6, 5, 4, 3]) {
      const next = { ...prev, homeScore: prev.homeScore + pts, clockSeconds: prev.clockSeconds! - 30 };
      const r = nbaCandidates(prev, next, { ...nba, run });
      if (r.candidate) fired += 1;
      run = r.run;
      prev = next;
    }
    expect(fired).toBe(1);
    expect(run).toMatchObject({ side: 'home', points: 18, prompted: true });
  });
  it('a buzzer-beater to end a period', () => {
    const before = live({ period: 2, clockSeconds: 2, homeScore: 50, awayScore: 52 });
    const { candidate } = nbaCandidates(before, { ...before, period: 2, periodState: 'end', clockSeconds: 0, awayScore: 55 }, nba);
    expect(candidate).toMatchObject({ rule: 'buzzer_beater', audience: 'away', milestone: true });
  });
});

describe('the MLS rules from the summary', () => {
  const p = (over: Partial<MlsPlay>): MlsPlay => ({
    seq: 1, period: 2, minute: 60, clock: "60'", wallclock: null, type: 'Goal', text: '', homeScore: 0, awayScore: 0, scoringSide: null, scorerName: null, kind: null, ...over,
  });
  const mls = { homeName: 'Inter Miami', awayName: 'Charlotte', seen: 0 };
  it('a goal in the 85th minute or later, a red card, a penalty, a hat trick, a shootout', () => {
    const plays = [
      p({ seq: 1, minute: 20, clock: "20'", homeScore: 1, scoringSide: 'home', scorerName: 'Messi' }),
      p({ seq: 2, minute: 40, clock: "40'", homeScore: 2, scoringSide: 'home', scorerName: 'Messi' }),
      p({ seq: 3, minute: 70, clock: "70'", type: 'Red Card', text: 'Red card, Charlotte', homeScore: 2 }),
      p({ seq: 4, minute: 78, clock: "78'", type: 'Penalty - Scored', homeScore: 2, awayScore: 1, scoringSide: 'away' }),
      p({ seq: 5, minute: 87, clock: "87'", homeScore: 3, awayScore: 1, scoringSide: 'home', scorerName: 'Messi' }),
      p({ seq: 6, minute: 90, clock: "90'", type: 'Start Shootout', homeScore: 3, awayScore: 1 }),
    ];
    const rules = mlsCandidates(plays, mls).map((c) => [c.rule, c.audience]);
    expect(rules).toEqual([
      ['red_card', 'home'],
      ['penalty', 'away'],
      ['hat_trick', 'home'],
      ['shootout', 'all'],
    ]);
    // Only the plays since the last poll are considered.
    expect(mlsCandidates(plays, { ...mls, seen: 5 }).map((c) => c.rule)).toEqual(['shootout']);
  });
  it('a routine mid-match goal does not prompt', () => {
    expect(mlsCandidates([p({ minute: 30, clock: "30'", homeScore: 1, scoringSide: 'home' })], mls)).toEqual([]);
  });
});

describe('caps and spacing', () => {
  const scheduled = { kind: 'checkin' as const, firedAt: '2026-09-24T02:30:00Z' };
  const event = (m: number) => ({ kind: 'event' as const, firedAt: `2026-09-24T01:${String(m).padStart(2, '0')}:00Z` });

  it('three at most, the scheduled slot held back until it fires', () => {
    expect(promptSlots([])).toEqual({ used: 0, eventsUsed: 0, scheduledFired: false, heldBack: true });
    expect(slotsCopy(promptSlots([event(10)]))).toBe('1 of 3 used. One is held back for late in the game.');
    expect(promptSlots([event(10), event(30), event(50)]).eventsUsed).toBe(2);
    expect(slotsCopy(promptSlots([event(10), event(30), scheduled]))).toBe('3 of 3 used. That is every prompt for this game.');
  });

  it('the game slot: no prompts in the first ten minutes, two events, the scheduled one once', () => {
    const base = { prompts: [], startedAt: '2026-09-24T01:00:00Z', now: '2026-09-24T01:05:00Z', gameOver: false, inScheduledWindow: false };
    expect(gameSlot({ ...base, kind: 'event' })).toEqual({ ok: false, reason: 'quiet_start' });
    const later = { ...base, now: '2026-09-24T02:00:00Z' };
    expect(gameSlot({ ...later, kind: 'event' })).toEqual({ ok: true, merge: false });
    expect(gameSlot({ ...later, kind: 'event', prompts: [event(10), event(30)] })).toEqual({ ok: false, reason: 'event_cap' });
    expect(gameSlot({ ...later, kind: 'checkin', prompts: [event(10), event(30)] })).toEqual({ ok: true, merge: false });
    expect(gameSlot({ ...later, kind: 'checkin', prompts: [scheduled] })).toEqual({ ok: false, reason: 'scheduled_fired' });
    expect(gameSlot({ ...later, kind: 'event', gameOver: true })).toEqual({ ok: false, reason: 'game_over' });
  });

  it('an event inside the late window becomes the scheduled prompt', () => {
    expect(gameSlot({ kind: 'event', prompts: [event(10), event(30)], startedAt: '2026-09-24T01:00:00Z', now: '2026-09-24T03:00:00Z', gameOver: false, inScheduledWindow: true })).toEqual({ ok: true, merge: true });
    expect(gameSlot({ kind: 'event', prompts: [scheduled], startedAt: '2026-09-24T01:00:00Z', now: '2026-09-24T03:00:00Z', gameOver: false, inScheduledWindow: true })).toEqual({ ok: true, merge: false });
  });

  it('a recipient: side targeting, twelve minutes apart, silenced after two ignored', () => {
    const now = '2026-09-24T02:00:00Z';
    const base = { audience: 'home' as const, rootingSide: 'home' as const, deliveries: [], now, promptsOff: false, mutedTonight: false, sessionOpen: true };
    expect(recipientDecision(base)).toEqual({ ok: true });
    expect(recipientDecision({ ...base, rootingSide: 'away' })).toEqual({ ok: false, reason: 'wrong_side' });
    expect(recipientDecision({ ...base, rootingSide: null })).toEqual({ ok: false, reason: 'no_side' });
    expect(recipientDecision({ ...base, rootingSide: null, audience: 'all' })).toEqual({ ok: true });
    expect(recipientDecision({ ...base, promptsOff: true })).toEqual({ ok: false, reason: 'off' });
    expect(recipientDecision({ ...base, mutedTonight: true })).toEqual({ ok: false, reason: 'muted' });
    expect(recipientDecision({ ...base, sessionOpen: false })).toEqual({ ok: false, reason: 'session_ended' });
    expect(recipientDecision({ ...base, deliveries: [{ firedAt: '2026-09-24T01:50:00Z', answered: true, windowSeconds: 120 }] })).toEqual({ ok: false, reason: 'too_soon' });
    expect(recipientDecision({ ...base, deliveries: [{ firedAt: '2026-09-24T01:47:00Z', answered: true, windowSeconds: 120 }] })).toEqual({ ok: true });
    const ignored = (t: string) => ({ firedAt: t, answered: false, windowSeconds: 120 });
    expect(recipientDecision({ ...base, deliveries: [ignored('2026-09-24T01:10:00Z'), ignored('2026-09-24T01:30:00Z')] })).toEqual({ ok: false, reason: 'silenced' });
    expect(recipientDecision({ ...base, deliveries: [ignored('2026-09-24T01:10:00Z'), { firedAt: '2026-09-24T01:30:00Z', answered: true, windowSeconds: 120 }] })).toEqual({ ok: true });
  });

  it('three self-triggers within 90 seconds is a crowd moment; two is not; one fan three times is not', () => {
    const now = '2026-09-24T02:00:00Z';
    expect(crowdSignal([{ userId: 'a', at: '2026-09-24T01:59:00Z' }, { userId: 'b', at: '2026-09-24T01:59:30Z' }, { userId: 'c', at: '2026-09-24T01:58:40Z' }], now)).toBe(true);
    expect(crowdSignal([{ userId: 'a', at: '2026-09-24T01:59:00Z' }, { userId: 'b', at: '2026-09-24T01:59:30Z' }], now)).toBe(false);
    expect(crowdSignal([{ userId: 'a', at: '2026-09-24T01:59:00Z' }, { userId: 'a', at: '2026-09-24T01:59:30Z' }, { userId: 'a', at: '2026-09-24T01:58:40Z' }], now)).toBe(false);
    expect(crowdSignal([{ userId: 'a', at: '2026-09-24T01:59:00Z' }, { userId: 'b', at: '2026-09-24T01:59:30Z' }, { userId: 'c', at: '2026-09-24T01:50:00Z' }], now)).toBe(false);
  });
});

describe('the snapshot and the NFL relabel', () => {
  it('parses clocks per sport', () => {
    expect(parseClock('nba', '4:12')).toBe(252);
    expect(parseClock('nfl', '0:03')).toBe(3);
    expect(parseClock('mls', "67'")).toBe(67);
    expect(parseClock('mls', "90'+4'")).toBe(94);
    expect(parseClock('mlb', null)).toBeNull();
    expect(toSnapshot('nba', { status: 'live', inning: 4, inning_state: 'live', clock: '1:52', home_score: 99, away_score: 101, fetched_at: at }, 0.4)).toMatchObject({ period: 4, clockSeconds: 112, homeWp: 0.4 });
  });

  it('rewrites a coarse touchdown to the real play, recomputes significance and pins the point', () => {
    const rows = [
      { qtr: 4, desc: 'kickoff', sp: 0, home_wp: 0.4, total_home_score: 20, total_away_score: 24 },
      { qtr: 4, desc: '(4:12) S.Barkley right end for 90 yards, TOUCHDOWN.', sp: 1, home_wp: 0.86, total_home_score: 26, total_away_score: 24, play_type: 'run', yards_gained: 90, td_player_name: 'Saquon Barkley', touchdown: 1 },
      { qtr: 4, desc: 'extra point good', sp: 1, home_wp: 0.87, total_home_score: 27, total_away_score: 24, extra_point_attempt: 1 },
    ];
    expect(relabelPrompt({ homeScore: 26, awayScore: 24 }, rows)).toEqual({
      labelFinal: "Saquon Barkley's 90-yard touchdown run",
      significance: 46,
      wpSeq: 2,
      periodLabel: '4th quarter',
    });
    expect(relabelPrompt({ homeScore: 30, awayScore: 24 }, rows)).toBeNull();
  });

  it('labels a pick-six, a 62-yard catch, a long field goal and a safety', () => {
    expect(playLabel({ qtr: 2, desc: '', sp: 1, home_wp: 0.5, total_home_score: 0, total_away_score: 0, touchdown: 1, return_touchdown: 1, interception: 1, yards_gained: 38, td_player_name: 'Cooper DeJean' })).toBe("Cooper DeJean's 38-yard pick-six");
    expect(playLabel({ qtr: 2, desc: '', sp: 1, home_wp: 0.5, total_home_score: 0, total_away_score: 0, touchdown: 1, play_type: 'pass', yards_gained: 62, td_player_name: 'A.J. Brown' })).toBe("A.J. Brown's 62-yard touchdown catch");
    expect(playLabel({ qtr: 2, desc: '', sp: 1, home_wp: 0.5, total_home_score: 0, total_away_score: 0, field_goal_result: 'made', kick_distance: 57 })).toBe('57-yard field goal');
    expect(playLabel({ qtr: 2, desc: '', sp: 1, home_wp: 0.5, total_home_score: 0, total_away_score: 0, safety: 1 })).toBe('Safety');
  });
});
