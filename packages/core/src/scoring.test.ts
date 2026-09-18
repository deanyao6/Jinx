import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseMlbFeed, type MlbFeed } from './providers/mlb/parse.js';
import { buildStorySteps, parseWinProbability, type RawEntry } from './providers/mlb/winprob.js';
import { loadDetail } from './providers/nfl/fixtures.test-helpers.js';
import { buildPbpStorySteps, parsePbpWinProbability } from './providers/nfl/winprob.js';
import { timelineRows } from './rows.js';
import {
  mlbScorer,
  nflScorer,
  scoringLines,
  scoringNote,
  scoringWhen,
  shortDescription,
  type ScoringRow,
} from './scoring.js';
import type { CanonicalGameDetail, MlbPlay, NflPlay } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
const mlbFixtures = join(here, '../../../ingest/fixtures/mlb');
const loadFeed = (name: string): MlbFeed =>
  JSON.parse(readFileSync(join(mlbFixtures, name), 'utf8')) as MlbFeed;

// ---------------------------------------------------------------------------
// NFL: who a play names
// ---------------------------------------------------------------------------

const nflPlay = (over: Partial<NflPlay>): NflPlay => ({
  order: 1,
  playId: '1',
  qtr: 1,
  clock: '01:35',
  quarterSecondsRemaining: 95,
  gameSecondsRemaining: 2795,
  timeOfDay: null,
  description: '',
  isScoringPlay: true,
  playType: null,
  homeScore: 0,
  awayScore: 6,
  posSide: 'away',
  tdSide: null,
  scorerProviderId: null,
  scorerName: null,
  touchdown: false,
  returnTouchdown: false,
  interception: false,
  fumble: false,
  safety: false,
  fieldGoalResult: null,
  kickDistance: null,
  kickoffAttempt: false,
  puntAttempt: false,
  extraPointAttempt: false,
  twoPointAttempt: false,
  ...over,
});

describe('nflScorer', () => {
  it('names the touchdown scorer, whoever reached the end zone', () => {
    const rushing = nflPlay({
      touchdown: true,
      tdSide: 'away',
      scorerProviderId: '00-0036275',
      scorerName: 'D.Swift',
    });
    expect(nflScorer(rushing)).toEqual({
      kind: 'touchdown',
      scorerProviderId: '00-0036275',
      scorerName: 'D.Swift',
    });
    const pickSix = nflPlay({
      touchdown: true,
      returnTouchdown: true,
      interception: true,
      tdSide: 'home',
      scorerProviderId: '00-0099999',
      scorerName: 'C.Gardner-Johnson',
    });
    expect(nflScorer(pickSix).kind).toBe('touchdown');
    expect(nflScorer(pickSix).scorerName).toBe('C.Gardner-Johnson');
  });

  it('names the kicker on a field goal, which is a real score', () => {
    const fg = nflPlay({
      fieldGoalResult: 'made',
      kickDistance: 44,
      scorerProviderId: '00-0033787',
      scorerName: 'J.Elliott',
    });
    expect(nflScorer(fg)).toEqual({
      kind: 'field_goal',
      scorerProviderId: '00-0033787',
      scorerName: 'J.Elliott',
    });
  });

  it('names nobody for an extra point: no one cares that the kicker made the PAT', () => {
    const pat = nflPlay({
      extraPointAttempt: true,
      scorerProviderId: '00-0031203',
      scorerName: 'C.Santos',
    });
    expect(nflScorer(pat)).toEqual({
      kind: 'extra_point',
      scorerProviderId: null,
      scorerName: null,
    });
  });

  it('names nobody for a two-point conversion or a safety', () => {
    expect(nflScorer(nflPlay({ twoPointAttempt: true, scorerName: 'C.Brown' }))).toEqual({
      kind: 'two_point',
      scorerProviderId: null,
      scorerName: null,
    });
    expect(nflScorer(nflPlay({ safety: true }))).toEqual({
      kind: 'safety',
      scorerProviderId: null,
      scorerName: null,
    });
  });

  it('calls anything else other, unnamed', () => {
    expect(nflScorer(nflPlay({}))).toEqual({
      kind: 'other',
      scorerProviderId: null,
      scorerName: null,
    });
  });

  it('holds on the real play-by-play: every kind appears in Ravens at Bengals 2024', () => {
    const detail = loadDetail('2024_05_BAL_CIN');
    const kinds = detail.timeline.map((e) => e.kind);
    expect(kinds).toContain('touchdown');
    expect(kinds).toContain('extra_point');
    expect(kinds).toContain('two_point');
    expect(kinds).toContain('safety');
    expect(kinds.every((k) => k !== undefined)).toBe(true);
    // The Henry safety in the second quarter carries no name.
    const safety = detail.timeline.find((e) => e.kind === 'safety');
    expect(safety?.scorerName ?? null).toBeNull();
    expect(safety?.homeScore).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// MLB: the batter and the event
// ---------------------------------------------------------------------------

const mlbPlay = (over: Partial<MlbPlay>): MlbPlay => ({
  index: 0,
  inning: 1,
  half: 'bottom',
  startTime: null,
  endTime: null,
  eventType: 'single',
  event: 'Single',
  description: '',
  rbi: 0,
  homeScore: 1,
  awayScore: 0,
  isScoringPlay: true,
  isOut: false,
  outsAfter: 0,
  batterId: '646240',
  batterName: 'Rafael Devers',
  pitcherId: '1',
  pitcherName: 'P',
  battingSide: 'home',
  pitchCount: 1,
  allStrikes: false,
  runnersOnStart: 0,
  runScoredOn: null,
  ...over,
});

describe('mlbScorer', () => {
  it('names the batter on a home run, solo or not', () => {
    expect(mlbScorer(mlbPlay({ eventType: 'home_run', rbi: 1 }))).toEqual({
      kind: 'home_run',
      scorerProviderId: '646240',
      scorerName: 'Rafael Devers',
    });
    expect(mlbScorer(mlbPlay({ eventType: 'home_run', rbi: 4 })).kind).toBe('home_run');
  });

  it('names the batter on any plate appearance with an RBI', () => {
    expect(mlbScorer(mlbPlay({ eventType: 'double', rbi: 1 })).kind).toBe('double');
    expect(mlbScorer(mlbPlay({ eventType: 'sac_fly', rbi: 1 })).kind).toBe('sac_fly');
    expect(mlbScorer(mlbPlay({ eventType: 'walk', rbi: 1 })).kind).toBe('walk');
    expect(mlbScorer(mlbPlay({ eventType: 'intent_walk', rbi: 1 })).kind).toBe('walk');
    expect(mlbScorer(mlbPlay({ eventType: 'hit_by_pitch', rbi: 1 })).kind).toBe('hit_by_pitch');
    expect(mlbScorer(mlbPlay({ eventType: 'force_out', rbi: 1 })).kind).toBe('groundout');
    expect(
      mlbScorer(mlbPlay({ eventType: 'field_out', rbi: 1, description: 'X grounds out, ...' }))
        .kind,
    ).toBe('groundout');
    expect(
      mlbScorer(mlbPlay({ eventType: 'field_out', rbi: 1, description: 'X flies out to ...' }))
        .kind,
    ).toBe('flyout');
    expect(mlbScorer(mlbPlay({ eventType: 'fielders_choice_out', rbi: 1 })).kind).toBe(
      'fielders_choice',
    );
    expect(mlbScorer(mlbPlay({ eventType: 'sac_fly', rbi: 1 })).scorerName).toBe('Rafael Devers');
  });

  it('names nobody when the run came home on a wild pitch, a passed ball or a balk', () => {
    const wp = mlbPlay({
      eventType: 'strikeout',
      description: 'Matt Carpenter strikes out swinging.',
      runScoredOn: {
        eventType: 'wild_pitch',
        event: 'Wild Pitch',
        runnerId: '676475',
        runnerName: 'Alec Burleson',
      },
    });
    expect(mlbScorer(wp)).toEqual({ kind: 'wild_pitch', scorerProviderId: null, scorerName: null });
    expect(
      mlbScorer(
        mlbPlay({
          eventType: 'walk',
          runScoredOn: {
            eventType: 'passed_ball',
            event: 'Passed Ball',
            runnerId: '',
            runnerName: '',
          },
        }),
      ).kind,
    ).toBe('passed_ball');
    expect(
      mlbScorer(
        mlbPlay({
          eventType: 'strikeout',
          runScoredOn: { eventType: 'balk', event: 'Balk', runnerId: '', runnerName: '' },
        }),
      ).kind,
    ).toBe('balk');
  });

  it('names the runner on a steal of home', () => {
    expect(
      mlbScorer(
        mlbPlay({
          eventType: 'strikeout',
          runScoredOn: {
            eventType: 'stolen_base_home',
            event: 'Stolen Base Home',
            runnerId: '660271',
            runnerName: 'Shohei Ohtani',
          },
        }),
      ),
    ).toEqual({ kind: 'steal', scorerProviderId: '660271', scorerName: 'Shohei Ohtani' });
  });

  it('names the batter who reached on the error a run scored on, and nobody on a runner error', () => {
    expect(mlbScorer(mlbPlay({ eventType: 'field_error', rbi: 0 }))).toEqual({
      kind: 'error',
      scorerProviderId: '646240',
      scorerName: 'Rafael Devers',
    });
    expect(
      mlbScorer(
        mlbPlay({
          eventType: 'single',
          rbi: 0,
          runScoredOn: { eventType: 'error', event: 'Error', runnerId: '1', runnerName: 'R' },
        }),
      ),
    ).toEqual({ kind: 'error', scorerProviderId: null, scorerName: null });
  });

  it('leaves an unexplained run under a strikeout unnamed', () => {
    expect(mlbScorer(mlbPlay({ eventType: 'strikeout', rbi: 0 }))).toEqual({
      kind: 'other',
      scorerProviderId: null,
      scorerName: null,
    });
  });

  it('holds on the real feed: World Series Game 1, 2024', () => {
    const detail = parseMlbFeed(loadFeed('feed_775300_NYY_LAD_WS1_walkoff_slam_2024-10-25.json'));
    expect(detail.timeline.map((e) => [e.kind, e.scorerName, e.awayScore + e.homeScore])).toEqual([
      ['sac_fly', 'Will Smith', 1],
      ['home_run', 'Giancarlo Stanton', 3],
      ['sac_fly', 'Mookie Betts', 4],
      ['groundout', 'Anthony Volpe', 5],
      ['home_run', 'Freddie Freeman', 9],
    ]);
    expect(detail.timeline[4]?.scorerProviderId).toBe('518692');
  });

  it('reads the wild pitch out of the runners when the batter struck out', () => {
    const detail = parseMlbFeed(loadFeed('feed_745164_SF_STL_rickwood_2024-06-20.json'));
    const wp = detail.timeline.find((e) => e.description.startsWith('Matt Carpenter strikes out'));
    expect(wp?.kind).toBe('wild_pitch');
    expect(wp?.scorerName ?? null).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

describe('scoringNote', () => {
  const nfl = (kind: string | null, scorerName: string | null, description = '') =>
    scoringNote({ sport: 'nfl', kind, scorerName, description, runs: 6 });
  const mlb = (kind: string | null, scorerName: string | null, runs: number, description = '') =>
    scoringNote({ sport: 'mlb', kind, scorerName, description, runs });

  it('says the football score and who', () => {
    expect(nfl('touchdown', 'A.J. Brown')).toBe('Touchdown, A.J. Brown');
    expect(nfl('touchdown', null)).toBe('Touchdown');
    expect(
      nfl(
        'field_goal',
        'Jake Elliott',
        '(13:08) 4-J.Elliott 44 yard field goal is GOOD, Center-57',
      ),
    ).toBe('44-yard field goal, Jake Elliott');
    expect(nfl('field_goal', 'Jake Elliott')).toBe('Field goal, Jake Elliott');
    expect(nfl('extra_point', null)).toBe('Extra point');
    expect(nfl('two_point', null)).toBe('Two-point conversion');
    expect(nfl('safety', null)).toBe('Safety');
  });

  it('says the baseball event with the runs it drove in', () => {
    expect(mlb('home_run', 'Rafael Devers', 1)).toBe('Home run, Rafael Devers');
    expect(mlb('home_run', 'Enrique Hernández', 2)).toBe('2-run home run, Enrique Hernández');
    expect(mlb('home_run', 'Brandon Marsh', 3)).toBe('3-run home run, Brandon Marsh');
    expect(mlb('home_run', 'Freddie Freeman', 4)).toBe('Grand slam, Freddie Freeman');
    expect(mlb('single', 'Colt Keith', 1)).toBe('RBI single, Colt Keith');
    expect(mlb('double', 'Trea Turner', 2)).toBe('2-run double, Trea Turner');
    expect(mlb('sac_fly', 'Bryce Harper', 1)).toBe('Sacrifice fly, Bryce Harper');
    expect(mlb('walk', 'Kyle Schwarber', 1)).toBe('Bases-loaded walk, Kyle Schwarber');
    expect(mlb('groundout', 'Anthony Volpe', 1)).toBe('RBI groundout, Anthony Volpe');
    expect(mlb('wild_pitch', null, 1)).toBe('Wild pitch');
    expect(mlb('balk', null, 1)).toBe('Balk');
    expect(mlb('steal', 'Shohei Ohtani', 1)).toBe('Steal of home, Shohei Ohtani');
    expect(mlb('error', 'Nick Castellanos', 1)).toBe('Reached on error, Nick Castellanos');
    expect(mlb('error', null, 1)).toBe('Error');
  });

  it('falls back to the play itself, shortened, for other and for a sport it does not know', () => {
    expect(
      mlb(
        'other',
        null,
        1,
        'Anthony Volpe grounds into a force out, shortstop Tommy Edman to second.',
      ),
    ).toBe('Anthony Volpe grounds into a force out');
    expect(nfl('other', null, '(5:52) 22-D.Henry right tackle tackled in End Zone, SAFETY.')).toBe(
      '22-D.Henry right tackle tackled in End Zone',
    );
    expect(nfl(null, null, 'Something happened.')).toBe('Something happened');
    expect(
      scoringNote({
        sport: 'nhl',
        kind: 'goal',
        scorerName: 'X',
        description: 'Goal by X.',
        runs: 1,
      }),
    ).toBe('Goal by X');
    expect(
      scoringNote({ sport: 'mlb', kind: null, scorerName: null, description: '', runs: 1 }),
    ).toBe('Score');
  });

  it('shortens to the first clause and drops the leading clock and formation', () => {
    expect(shortDescription('(1:35) (Shotgun) 4-D.Swift right guard for 3 yards, TOUCHDOWN.')).toBe(
      '4-D.Swift right guard for 3 yards',
    );
    expect(shortDescription('Riley Greene homers (23) on a fly ball to right field.')).toBe(
      'Riley Greene homers (23) on a fly ball to right field',
    );
  });
});

describe('scoringWhen', () => {
  it('reads the inning, the quarter and overtime', () => {
    expect(scoringWhen('mlb', 2, 'bottom', null)).toBe('Bot 2nd');
    expect(scoringWhen('mlb', 11, 'top', null)).toBe('Top 11th');
    expect(scoringWhen('mlb', 12, 'top', null)).toBe('Top 12th');
    expect(scoringWhen('mlb', 13, 'top', null)).toBe('Top 13th');
    expect(scoringWhen('mlb', 21, 'top', null)).toBe('Top 21st');
    expect(scoringWhen('nfl', 1, null, '01:35')).toBe('Q1 1:35');
    expect(scoringWhen('nfl', 4, null, '12:53')).toBe('Q4 12:53');
    expect(scoringWhen('nfl', 5, null, '04:12')).toBe('OT 4:12');
    expect(scoringWhen('nfl', 6, null, null)).toBe('2OT');
    expect(scoringWhen('nhl', 3, null, null)).toBe('3');
  });
});

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

const row = (over: Partial<ScoringRow> & Pick<ScoringRow, 'seq' | 'homeScore' | 'awayScore'>) => ({
  period: 1,
  half: null,
  clock: null,
  scoringSide: 'away' as const,
  description: '',
  kind: null,
  scorerPlayerId: null,
  scorerName: null,
  ...over,
});

describe('scoringLines', () => {
  it('folds the extra point into the touchdown before it and keeps the score after the PAT', () => {
    const lines = scoringLines('nfl', [
      row({
        seq: 1,
        awayScore: 6,
        homeScore: 0,
        kind: 'touchdown',
        scorerName: "D'Andre Swift",
        scorerPlayerId: 'p1',
        clock: '01:35',
      }),
      row({ seq: 2, awayScore: 7, homeScore: 0, kind: 'extra_point', clock: '01:31' }),
      row({
        seq: 3,
        awayScore: 7,
        homeScore: 3,
        kind: 'field_goal',
        scoringSide: 'home',
        scorerName: 'Jake Elliott',
        period: 2,
        clock: '13:08',
        description: '(13:08) 4-J.Elliott 44 yard field goal is GOOD',
      }),
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      seq: 1,
      note: "Touchdown, D'Andre Swift",
      suffix: 'PAT good',
      awayScore: 7,
      homeScore: 0,
      folded: [2],
      scorerPlayerId: 'p1',
    });
    expect(lines[1]).toMatchObject({
      seq: 3,
      note: '44-yard field goal, Jake Elliott',
      suffix: null,
      awayScore: 7,
      homeScore: 3,
    });
  });

  it('folds a two-point conversion the same way, and leaves a stray conversion alone', () => {
    const lines = scoringLines('nfl', [
      row({ seq: 1, awayScore: 0, homeScore: 6, kind: 'touchdown', scoringSide: 'home' }),
      row({ seq: 2, awayScore: 0, homeScore: 8, kind: 'two_point', scoringSide: 'home' }),
      row({ seq: 3, awayScore: 1, homeScore: 8, kind: 'extra_point', scoringSide: 'away' }),
    ]);
    expect(lines.map((l) => [l.note, l.suffix])).toEqual([
      ['Touchdown', 'Two-point conversion good'],
      ['Extra point', null],
    ]);
  });

  it('never folds in baseball and works out the runs from the score', () => {
    const lines = scoringLines('mlb', [
      row({
        seq: 1,
        awayScore: 0,
        homeScore: 1,
        kind: 'home_run',
        scoringSide: 'home',
        scorerName: 'Alex Call',
        period: 2,
        half: 'bottom',
      }),
      row({
        seq: 2,
        awayScore: 0,
        homeScore: 3,
        kind: 'home_run',
        scoringSide: 'home',
        scorerName: 'Enrique Hernández',
        period: 2,
        half: 'bottom',
      }),
      row({
        seq: 3,
        awayScore: 2,
        homeScore: 3,
        kind: 'double',
        scorerName: 'Bryce Harper',
        period: 6,
        half: 'top',
      }),
    ]);
    expect(lines.map((l) => l.note)).toEqual([
      'Home run, Alex Call',
      '2-run home run, Enrique Hernández',
      '2-run double, Bryce Harper',
    ]);
  });

  it('sorts by seq whatever order the rows arrive in', () => {
    const lines = scoringLines('mlb', [
      row({ seq: 2, awayScore: 0, homeScore: 3, kind: 'home_run', scorerName: 'B' }),
      row({ seq: 1, awayScore: 0, homeScore: 1, kind: 'home_run', scorerName: 'A' }),
    ]);
    expect(lines.map((l) => l.note)).toEqual(['Home run, A', '2-run home run, B']);
  });
});

// ---------------------------------------------------------------------------
// What the writer stores
// ---------------------------------------------------------------------------

describe('timelineRows', () => {
  it('stores the kind, and the resolved player with the full name we hold for him', () => {
    const detail = loadDetail('2024_05_BAL_CIN');
    const td = detail.timeline[0]!;
    // The fixture's play-by-play carries no scorer columns; add one to show the lookup.
    const named: CanonicalGameDetail = {
      ...detail,
      timeline: [{ ...td, scorerProviderId: '00-0032764', scorerName: 'D.Henry' }],
    };
    const rows = timelineRows(
      named,
      'g1',
      new Map([['00-0032764', { id: 'p9', fullName: 'Derrick Henry' }]]),
    );
    expect(rows[0]).toMatchObject({
      game_id: 'g1',
      seq: 1,
      kind: 'touchdown',
      scorer_player_id: 'p9',
      scorer_name: 'Derrick Henry',
    });
  });

  it('keeps the provider name and no id for a scorer we have no row for, and nulls where nothing is known', () => {
    const detail = loadDetail('2024_05_BAL_CIN');
    const named: CanonicalGameDetail = {
      ...detail,
      timeline: [
        { ...detail.timeline[0]!, scorerProviderId: '00-0000001', scorerName: 'D.Henry' },
        (({ kind: _k, scorerProviderId: _p, scorerName: _n, ...rest }) => rest)(
          detail.timeline[1]!,
        ),
      ],
    };
    const rows = timelineRows(named, 'g1');
    expect(rows[0]).toMatchObject({ scorer_player_id: null, scorer_name: 'D.Henry' });
    expect(rows[1]).toMatchObject({ kind: null, scorer_player_id: null, scorer_name: null });
  });
});

// ---------------------------------------------------------------------------
// Relive steps follow the same rule
// ---------------------------------------------------------------------------

describe('story steps carry the scorer by the same rule', () => {
  it('NFL: the touchdown and the field goal are named, the extra point is not', () => {
    const rows = [
      {
        play_id: 1,
        qtr: 1,
        desc: 'kickoff',
        sp: 0,
        home_wp: 0.5,
        total_home_score: 0,
        total_away_score: 0,
        time_of_day: null,
      },
      {
        play_id: 2,
        qtr: 1,
        desc: 'D.Swift 3 yards, TOUCHDOWN.',
        sp: 1,
        home_wp: 0.4,
        total_home_score: 0,
        total_away_score: 6,
        time_of_day: null,
        touchdown: 1,
        td_team: 'CHI',
        scorer_player_id: '00-0036275',
        scorer_name: 'D.Swift',
      },
      {
        play_id: 3,
        qtr: 1,
        desc: 'C.Santos extra point is GOOD.',
        sp: 1,
        home_wp: 0.39,
        total_home_score: 0,
        total_away_score: 7,
        time_of_day: null,
        extra_point_attempt: 1,
        scorer_player_id: '00-0031203',
        scorer_name: 'C.Santos',
      },
      {
        play_id: 4,
        qtr: 2,
        desc: 'J.Elliott 44 yard field goal is GOOD.',
        sp: 1,
        home_wp: 0.45,
        total_home_score: 3,
        total_away_score: 7,
        time_of_day: null,
        field_goal_result: 'made',
        scorer_player_id: '00-0033787',
        scorer_name: 'J.Elliott',
      },
    ];
    const points = parsePbpWinProbability(rows);
    const steps = buildPbpStorySteps(rows, points, {
      awayScore: 24,
      homeScore: 15,
      awayName: 'Bears',
      homeName: 'Eagles',
    });
    expect(steps.map((s) => [s.label, s.kind, s.scorerName])).toEqual([
      ['Pregame', null, null],
      ['1st quarter', 'touchdown', 'D.Swift'],
      ['1st quarter', 'extra_point', null],
      ['2nd quarter', 'field_goal', 'J.Elliott'],
      ['Final', null, null],
    ]);
  });

  it('MLB: the batter is named from the win probability entries, which are full plays', () => {
    const entries: RawEntry[] = [
      {
        about: { inning: 1, halfInning: 'top' },
        result: {
          description: 'X singles.',
          event: 'Single',
          eventType: 'single',
          rbi: 0,
          awayScore: 0,
          homeScore: 0,
        },
        matchup: { batter: { id: 1, fullName: 'X' } },
        homeTeamWinProbability: 50,
      },
      {
        about: { inning: 1, halfInning: 'bottom' },
        result: {
          description:
            'Rafael Devers homers (24) on a fly ball to center field. Jung Hoo Lee scores.',
          event: 'Home Run',
          eventType: 'home_run',
          rbi: 2,
          awayScore: 0,
          homeScore: 2,
        },
        matchup: { batter: { id: 646240, fullName: 'Rafael Devers' } },
        homeTeamWinProbability: 65,
      },
      {
        about: { inning: 2, halfInning: 'top' },
        result: {
          description: 'Y strikes out swinging.',
          event: 'Strikeout',
          eventType: 'strikeout',
          rbi: 0,
          awayScore: 1,
          homeScore: 2,
        },
        matchup: { batter: { id: 2, fullName: 'Y' } },
        runners: [
          {
            movement: { end: 'score' },
            details: {
              event: 'Wild Pitch',
              eventType: 'wild_pitch',
              isScoringEvent: true,
              runner: { id: 3, fullName: 'Z' },
            },
          },
        ],
        homeTeamWinProbability: 60,
      },
    ];
    const points = parseWinProbability(entries);
    const steps = buildStorySteps(entries, points, {
      awayScore: 2,
      homeScore: 5,
      awayName: 'Tigers',
      homeName: 'Giants',
    });
    expect(
      steps.map((s) => [s.label, s.kind ?? null, s.scorerProviderId ?? null, s.scorerName ?? null]),
    ).toEqual([
      ['Pregame', null, null, null],
      ['Bottom 1st', 'home_run', '646240', 'Rafael Devers'],
      ['Top 2nd', 'wild_pitch', null, null],
      ['Final', null, null, null],
    ]);
  });
});
