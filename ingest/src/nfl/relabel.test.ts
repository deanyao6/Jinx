import { readFileSync } from 'node:fs';
import { relabelPrompt, type RelabelPlay } from '@jinx/core';
import { describe, expect, it } from 'vitest';

/**
 * The NFL upgrade path against a fixture game (docs/prompts/social/03, acceptance): a coarse
 * live prompt, "Touchdown, Eagles" at 7-3, is rewritten overnight to the real play from the
 * nflverse play-by-play of 2025_13_CHI_PHI, given nflverse's own win probability, and pinned
 * to its point on the line.
 */
const rows = (JSON.parse(readFileSync(new URL('../../fixtures/nfl/pbp_2025_13_CHI_PHI.json', import.meta.url), 'utf8')) as Record<string, string>[])
  .map((r): RelabelPlay => ({
    qtr: r.qtr ? Number(r.qtr) : null,
    desc: r.desc ?? null,
    sp: r.sp ? Number(r.sp) : null,
    home_wp: r.home_wp ? Number(r.home_wp) : null,
    total_home_score: r.total_home_score ? Number(r.total_home_score) : null,
    total_away_score: r.total_away_score ? Number(r.total_away_score) : null,
  }));

describe('the overnight relabel against 2025_13_CHI_PHI', () => {
  it('finds the first scoring play that put the board where the prompt saw it', () => {
    const scoring = rows.filter((r) => r.sp === 1);
    expect(scoring.length).toBeGreaterThan(3);
    const first = scoring[0]!;
    const r = relabelPrompt({ homeScore: first.total_home_score!, awayScore: first.total_away_score! }, rows);
    expect(r).not.toBeNull();
    // The fixture is trimmed to the columns Relive reads, so the label is the description itself.
    expect(r!.labelFinal).toBe(first.desc!.replace(/\s+/g, ' ').trim().slice(0, 110).trimEnd() + (first.desc!.length > 110 ? '…' : ''));
    expect(r!.periodLabel).toMatch(/quarter|Overtime/);
    expect(r!.wpSeq).toBeGreaterThan(1);
    // Significance is nflverse's swing on that play, never the coarse approximation.
    const before = rows.slice(0, rows.indexOf(first)).reverse().find((x) => x.home_wp != null)!.home_wp!;
    expect(r!.significance).toBe(Math.round(Math.abs(first.home_wp! - before) * 1000) / 10);
  });

  it('leaves a prompt whose score no play ever read', () => {
    expect(relabelPrompt({ homeScore: 99, awayScore: 98 }, rows)).toBeNull();
  });
});
