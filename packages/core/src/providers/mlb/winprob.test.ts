import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildStorySteps, parseWinProbability, periodLabel } from './winprob.js';

/** Tigers at Giants, 2026-08-08, final 5–2. A real game Dean attended. */
const entries = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../ingest/fixtures/mlb/winprob_823191_DET_SF_2026-08-08.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const FINAL = { awayScore: 2, homeScore: 5, awayName: 'Tigers', homeName: 'Giants' };

describe('periodLabel', () => {
  it('names the common innings', () => {
    expect(periodLabel(1, 'top')).toBe('Top 1st');
    expect(periodLabel(3, 'bottom')).toBe('Bottom 3rd');
    expect(periodLabel(9, 'top')).toBe('Top 9th');
  });

  it('keeps going into extras', () => {
    expect(periodLabel(10, 'bottom')).toBe('Bottom 10th');
    expect(periodLabel(11, 'top')).toBe('Top 11th');
    expect(periodLabel(12, 'top')).toBe('Top 12th');
    expect(periodLabel(13, 'top')).toBe('Top 13th');
    expect(periodLabel(21, 'top')).toBe('Top 21st');
  });
});

describe('parseWinProbability', () => {
  const points = parseWinProbability(entries);

  it('reads every plate appearance', () => {
    expect(points).toHaveLength(74);
  });

  it('converts the feed percentage to a fraction', () => {
    // The column is numeric(6,5) between 0 and 1; the feed says 46.4, not 0.464.
    expect(points.at(0)?.homeWp).toBeCloseTo(0.464, 3);
    expect(points.every((p) => p.homeWp >= 0 && p.homeWp <= 1)).toBe(true);
  });

  it('ends at certainty for the winner', () => {
    expect(points.at(-1)?.homeWp).toBe(1);
  });

  it('numbers points from one, in order', () => {
    expect(points.map((p) => p.seq)).toEqual(points.map((_, i) => i + 1));
  });

  it('drops entries it cannot read rather than guessing', () => {
    const withGap = [{ about: {}, result: {} }, ...entries.slice(0, 3)];
    expect(parseWinProbability(withGap)).toHaveLength(3);
  });
});

describe('buildStorySteps', () => {
  const points = parseWinProbability(entries);
  const steps = buildStorySteps(entries, points, FINAL);

  it('is pregame, the scoring plays, then the final', () => {
    // 5 scoring plays in this game, which matches game_scoring_timeline.
    expect(steps).toHaveLength(7);
    expect(steps.at(0)?.label).toBe('Pregame');
    expect(steps.at(-1)?.label).toBe('Final');
  });

  it('opens with the real pregame probability', () => {
    expect(steps.at(0)?.text).toBe('Giants were 46% to win before first pitch.');
  });

  it('shows the scoreboard as it read at each step', () => {
    expect(steps.at(1)).toMatchObject({ awayScore: 1, homeScore: 0, label: 'Top 1st' });
    expect(steps.at(2)).toMatchObject({ awayScore: 1, homeScore: 2, label: 'Bottom 1st' });
    expect(steps.at(5)).toMatchObject({ awayScore: 2, homeScore: 5, label: 'Bottom 5th' });
  });

  it('takes its text from the play, not a template', () => {
    expect(steps.at(2)?.text).toContain('Rafael Devers homers');
  });

  it('closes on the result', () => {
    expect(steps.at(-1)).toMatchObject({ awayScore: 2, homeScore: 5 });
    expect(steps.at(-1)?.text).toBe('Giants win 5–2.');
  });

  it('pins every step to a real probability point', () => {
    const seqs = new Set(points.map((p) => p.seq));
    expect(steps.every((s) => seqs.has(s.wpSeq))).toBe(true);
  });
});

describe('buildStorySteps, runs that carry no RBI', () => {
  // Braves 7, Nationals 2 on 2023-03-30. Two of the nine runs came home without an RBI: one on a
  // double play in the 4th, one on a throwing error in the 9th. Keying steps on RBI dropped both,
  // so the story jumped from 3-1 to 4-2 and stopped at 6-2 before a 7-2 final.
  const raw = JSON.parse(
    readFileSync(
      new URL(
        '../../../../../ingest/fixtures/mlb/winprob_718780_ATL_WSH_2023-03-30.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const pts = parseWinProbability(raw);
  const story = buildStorySteps(raw, pts, {
    awayScore: 7,
    homeScore: 2,
    awayName: 'Atlanta Braves',
    homeName: 'Washington Nationals',
  });
  const scoring = story.slice(1, -1);

  it('has a step for every change of score', () => {
    expect(scoring.map((s) => `${s.awayScore}-${s.homeScore}`)).toEqual([
      '1-0',
      '2-0',
      '3-0',
      '3-1',
      '4-1',
      '4-2',
      '6-2',
      '7-2',
    ]);
  });

  it('never skips a run: each step is the one before it plus what scored', () => {
    let total = 0;
    for (const s of scoring) {
      expect(s.awayScore + s.homeScore).toBeGreaterThan(total);
      total = s.awayScore + s.homeScore;
    }
    expect(total).toBe(9);
  });

  it('reaches the final score before the final step', () => {
    expect(scoring.at(-1)).toMatchObject({ awayScore: 7, homeScore: 2 });
  });

  it('keeps the play text when the play says who scored', () => {
    expect(scoring.at(4)?.text).toContain('grounds into a double play');
    expect(scoring.at(4)?.label).toBe('Top 4th');
  });
});
