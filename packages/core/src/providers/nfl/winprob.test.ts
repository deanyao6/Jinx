import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildPbpStorySteps, parsePbpWinProbability, quarterLabel } from './winprob.js';
import type { PbpWpRow } from './winprob.js';

/**
 * Bears at Eagles, Lincoln Financial Field, 28 November 2025 — one of Dean's own logged
 * games, captured from nflverse play_by_play_2025.csv.gz. Using a real game rather than a
 * constructed one is deliberate: it is the game the feature has to work on.
 */
const RAW = JSON.parse(
  readFileSync(
    new URL('../../../../../ingest/fixtures/nfl/pbp_2025_13_CHI_PHI.json', import.meta.url),
    'utf8',
  ),
) as Record<string, string | null>[];

/** The CSV reader turns these into numbers; the fixture keeps the file's own strings. */
const ROWS: PbpWpRow[] = RAW.map((r) => ({
  play_id: num(r['play_id']),
  qtr: num(r['qtr']),
  desc: r['desc'] ?? null,
  sp: num(r['sp']),
  home_wp: num(r['home_wp']),
  total_home_score: num(r['total_home_score']),
  total_away_score: num(r['total_away_score']),
  time_of_day: r['time_of_day'] || null,
}));

function num(v: string | null | undefined): number | null {
  if (v == null || v === '' || v === 'NA') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const FINAL = { awayScore: 24, homeScore: 15, awayName: 'Bears', homeName: 'Eagles' };

describe('quarterLabel', () => {
  it('names the four quarters', () => {
    expect([1, 2, 3, 4].map(quarterLabel)).toEqual([
      '1st quarter',
      '2nd quarter',
      '3rd quarter',
      '4th quarter',
    ]);
  });

  it('calls the fifth quarter overtime, and numbers a second one', () => {
    // nflverse numbers overtime as quarter 5; "5th quarter" is not a thing anyone says.
    expect(quarterLabel(5)).toBe('Overtime');
    expect(quarterLabel(6)).toBe('Overtime 2');
  });
});

describe('parsePbpWinProbability', () => {
  it('reads a point for every play that carries a probability', () => {
    const points = parsePbpWinProbability(ROWS);
    expect(points.length).toBeGreaterThan(150);
    expect(points.length).toBeLessThanOrEqual(ROWS.length);
    // seq is dense and 1-based, which is what game_wp_timeline's primary key assumes.
    expect(points.map((p) => p.seq)).toEqual(points.map((_, i) => i + 1));
  });

  it('keeps the values as fractions, unlike the MLB feed', () => {
    const points = parsePbpWinProbability(ROWS);
    for (const p of points) {
      expect(p.homeWp).toBeGreaterThanOrEqual(0);
      expect(p.homeWp).toBeLessThanOrEqual(1);
    }
    // The Eagles were close to even at kickoff and lost, so the line ends far below it.
    expect(points.at(0)?.homeWp).toBeGreaterThan(0.4);
    expect(points.at(-1)?.homeWp).toBeLessThan(0.1);
  });

  it('splits the game into halves, with overtime on the second', () => {
    const points = parsePbpWinProbability([
      row({ qtr: 1, home_wp: 0.5 }),
      row({ qtr: 2, home_wp: 0.5 }),
      row({ qtr: 3, home_wp: 0.5 }),
      row({ qtr: 5, home_wp: 0.5 }),
    ]);
    expect(points.map((p) => p.half)).toEqual(['top', 'top', 'bottom', 'bottom']);
  });

  it('drops a play it cannot read rather than guessing a point', () => {
    const points = parsePbpWinProbability([
      row({ qtr: 1, home_wp: 0.5 }),
      row({ qtr: 1, home_wp: null }), // a marker row (END QUARTER, timeout)
      row({ qtr: null, home_wp: 0.6 }),
      row({ qtr: 2, home_wp: 0.7 }),
    ]);
    expect(points.map((p) => p.homeWp)).toEqual([0.5, 0.7]);
    expect(points.map((p) => p.seq)).toEqual([1, 2]);
  });

  it('clamps a probability that arrives outside 0 to 1', () => {
    const points = parsePbpWinProbability([
      row({ qtr: 1, home_wp: 1.2 }),
      row({ qtr: 1, home_wp: -0.3 }),
    ]);
    expect(points.map((p) => p.homeWp)).toEqual([1, 0]);
  });
});

describe('buildPbpStorySteps', () => {
  const points = parsePbpWinProbability(ROWS);
  const steps = buildPbpStorySteps(ROWS, points, FINAL);

  it('opens on pregame and closes on the final', () => {
    expect(steps.at(0)?.label).toBe('Pregame');
    expect(steps.at(0)?.text).toMatch(/^Eagles were \d+% to win at kickoff\.$/);
    expect(steps.at(-1)?.label).toBe('Final');
    expect(steps.at(-1)?.text).toBe('Bears win 24–15.');
    expect(steps.at(-1)).toMatchObject({ awayScore: 24, homeScore: 15 });
  });

  it('has one step per scoring play in between', () => {
    const scoring = ROWS.filter((r) => r.sp === 1 && (r.desc ?? '').trim());
    expect(steps).toHaveLength(scoring.length + 2);
  });

  it('takes its text verbatim from the provider, never writing prose', () => {
    // The whole point: a story step is nflverse's own play description. If this ever has
    // to be relaxed, the text is being generated somewhere and SPEC 6.18 applies.
    const descriptions = new Set(ROWS.map((r) => (r.desc ?? '').trim()));
    for (const step of steps.slice(1, -1)) expect(descriptions.has(step.text)).toBe(true);
    expect(steps[1]?.text).toContain('4-D.Swift right guard for 3 yards, TOUCHDOWN.');
  });

  it('shows the score as the scoreboard read it after each play', () => {
    const scores = steps.map((s) => `${s.awayScore}-${s.homeScore}`);
    expect(scores.slice(0, 5)).toEqual(['0-0', '6-0', '7-0', '7-3', '10-3']);
    // Never goes backwards, because the scores are read off the play and not accumulated.
    const away = steps.map((s) => s.awayScore);
    expect([...away].sort((a, b) => a - b)).toEqual(away);
  });

  it('points every step at a probability that exists on the timeline', () => {
    const seqs = new Set(points.map((p) => p.seq));
    for (const step of steps) expect(seqs.has(step.wpSeq)).toBe(true);
  });

  it('says so plainly when a game ended level', () => {
    const tied = buildPbpStorySteps([], [], { ...FINAL, awayScore: 20, homeScore: 20 });
    expect(tied.at(-1)?.text).toBe('Tied 20–20.');
  });

  it('still produces a story for a game with no readable plays at all', () => {
    const none = buildPbpStorySteps([], [], FINAL);
    expect(none.map((s) => s.label)).toEqual(['Pregame', 'Final']);
    expect(none[0]?.text).toBe('Bears at Eagles.');
  });
});

function row(over: Partial<PbpWpRow>): PbpWpRow {
  return {
    play_id: 1,
    qtr: 1,
    desc: 'A play.',
    sp: 0,
    home_wp: 0.5,
    total_home_score: 0,
    total_away_score: 0,
    time_of_day: null,
    ...over,
  };
}
