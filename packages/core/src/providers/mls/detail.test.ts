import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { CanonicalGame } from '../../types.js';
import {
  buildMlsStory,
  detectMlsMoments,
  mlsInMatchHomeWp,
  mlsTrueLock,
  parseMlsSummaryDetail,
  type MlsSummaryDetail,
} from './detail.js';

const fixture = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../ingest/fixtures/mls/espn_summary_detail_655997_761829_2026-09-22.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  matches: Record<
    string,
    {
      keyEvents: MlsSummaryDetail['keyEvents'];
      rosters: { homeAway: 'home' | 'away'; team: string; first: unknown; subbed: unknown }[];
      header_status: { type: { name: string; state: string; completed: boolean }; period?: number };
      shootoutHeader: { homeAway: 'home' | 'away'; score: string; shootoutScore: number; winner: boolean }[];
    }
  >;
};

/** The trimmed fixture back into the summary's shape: the first and one subbed player per side. */
function summaryOf(id: string): MlsSummaryDetail {
  const m = fixture.matches[id]!;
  return {
    keyEvents: m.keyEvents ?? [],
    rosters: m.rosters.map((r) => ({
      homeAway: r.homeAway,
      team: { abbreviation: r.team, displayName: r.team },
      roster: [r.first, r.subbed].filter(Boolean),
    })),
    header: { competitions: [{ status: m.header_status, competitors: m.shootoutHeader }] },
    meta: {},
  } as MlsSummaryDetail;
}

const cup: CanonicalGame = {
  provider: 'espn_mls',
  providerGameId: '655997',
  sport: 'mls',
  season: 2022,
  seasonKey: 'mls:2022',
  seasonLabel: '2022',
  gameType: 'postseason',
  scheduledStart: '2022-11-05T20:00:00Z',
  providerVenueId: 'espn:7605',
  venueName: 'Banc of California Stadium',
  homeProviderTeamId: '18966',
  awayProviderTeamId: '10739',
  status: 'final',
  homeScore: 3,
  awayScore: 3,
  isTie: false,
  winnerProviderTeamId: '18966',
  decisionMethod: 'shootout',
  homeShootoutScore: 3,
  awayShootoutScore: 0,
  doubleheaderNumber: null,
  rescheduledFromProviderGameId: null,
  rescheduledToProviderGameId: null,
  isNeutralSite: false,
  finalAt: null,
};

describe('MLS detail from the summary: the 2022 MLS Cup (3-3, LAFC 3-0 on penalties)', () => {
  const detail = parseMlsSummaryDetail(summaryOf('655997'), cup);

  it('reads six goals in order with the score after each, the scorer, and the kind', () => {
    // LAFC 1-0 (Acosta), 1-1 (Gazdag), 2-1 (Murillo), 2-2 (Elliott), 2-3 in extra time
    // (Elliott), 3-3 (Bale), read as away-home; checked against the match report.
    expect(detail.timeline.map((t) => `${t.awayScore}-${t.homeScore}`)).toEqual([
      '0-1', '1-1', '1-2', '2-2', '3-2', '3-3',
    ]);
    expect(detail.timeline.map((t) => t.scoringSide)).toEqual(['home', 'away', 'home', 'away', 'away', 'home']);
    const last = detail.timeline[5]!;
    expect(last.scorerName).toBe('Gareth Bale');
    expect(last.kind).toBe('header');
    expect(last.period).toBe(4);
    expect(last.clock).toBe("120'+8'");
    expect(detail.timeline[0]!.kind).toBe('free_kick');
  });

  it('keeps every key event as a play with the running score, and the periods of extra time and the shootout', () => {
    if (detail.plays.sport !== 'mls') throw new Error('sport');
    const items = detail.plays.items;
    expect(items[0]!.type).toBe('Kickoff');
    expect(items.at(-1)!.type).toBe('End Match');
    expect(items.at(-1)!.period).toBe(5);
    expect(items.find((p) => p.type === 'Red Card')!.minute).toBe(116);
    expect(Math.max(...items.map((p) => p.period))).toBe(5);
    expect(detail.inningsOrPeriods).toBe(5);
  });

  it('appearances carry the players seen line: the keeper who conceded, the substituted scorer', () => {
    const keeper = detail.appearances.find((a) => a.fullName === 'Maxime Crépeau')!;
    expect(keeper.providerTeamId).toBe('18966');
    expect(keeper.line).toMatchObject({ gk: true, clean_sheet: false });
    const sub = detail.appearances.find((a) => a.providerTeamId === '18966' && a.fullName !== 'Maxime Crépeau')!;
    expect(sub.line).toMatchObject({ goals: 1, assists: 0, gk: false });
  });

  it('carries no wall clocks for a 2022 match, so the lock stays unreliable and the end unknown (a pledge is never punished)', () => {
    if (detail.plays.sport !== 'mls') throw new Error('sport');
    const lock = mlsTrueLock(detail.plays.items);
    expect(lock.reliable).toBe(false);
    expect(lock.reason).toBe('first_score');
    expect(detail.timestampsReliable).toBe(false);
    expect(detail.finalAt).toBeNull();
  });

  it('finds the moments: a red card and a shootout, no hat trick', () => {
    const types = detectMlsMoments(detail).map((e) => e.type).sort();
    expect(types).toEqual(['red_card', 'shootout']);
    expect(detectMlsMoments(detail).find((e) => e.type === 'red_card')!.playerName).toBe('Maxime Crépeau');
  });

  it('names the player sent off on a second yellow (692761, Bernardeschi)', () => {
    if (detail.plays.sport !== 'mls') throw new Error('sport');
    const red = detail.plays.items.find((p) => p.type === 'Red Card')!;
    const twice = {
      ...detail,
      plays: {
        sport: 'mls' as const,
        items: [...detail.plays.items, { ...red, seq: 999, text: 'Second yellow card to Federico Bernardeschi (Toronto FC).' }],
      },
    };
    const names = detectMlsMoments(twice).filter((e) => e.type === 'red_card').map((e) => e.playerName);
    expect(names).toEqual(['Maxime Crépeau', 'Federico Bernardeschi']);
  });

  it('tells the story: pregame, kick-off, goals, cards, breaks, penalties, the end with the shootout score, on a line that ends decided', () => {
    const { points, steps } = buildMlsStory(
      detail,
      { homeName: 'LAFC', awayName: 'Philadelphia Union' },
      { home: 0.45, draw: 0.28, away: 0.27 },
      { home: 3, away: 0 },
    );
    expect(steps[0]!.label).toBe('Pregame');
    expect(steps.some((s) => s.label === 'Kick-off')).toBe(true);
    expect(steps.some((s) => s.label === 'Halftime')).toBe(true);
    expect(steps.some((s) => s.label === 'Penalties')).toBe(true);
    expect(steps.filter((s) => s.kind).length).toBe(6);
    expect(steps.at(-1)!.text).toContain('LAFC win 3-0 on penalties');
    expect(points.length).toBe(steps.length + (steps.length < points.length ? points.length - steps.length : 0));
    expect(points[0]!.homeWp).toBe(0.45);
    expect(points.find((p) => p.seq === steps.find((s) => s.label === 'Penalties')!.wpSeq)!.homeWp).toBe(0.5);
    expect(points.at(-1)!.homeWp).toBe(1);
    const seqs = new Set(points.map((p) => p.seq));
    expect(steps.every((s) => seqs.has(s.wpSeq))).toBe(true);
  });
});

describe('the in-match line', () => {
  it('rises with a lead, falls behind, and is decided by the whistle', () => {
    const even = { home: 0.46, away: 0.27 };
    const level = mlsInMatchHomeWp(0, 0, 90, even);
    // Calibrated: the whole match ahead at 0-0 is the pregame view.
    expect(level).toBeCloseTo(0.46, 2);
    expect(mlsInMatchHomeWp(1, 0, 45, even)).toBeGreaterThan(level);
    expect(mlsInMatchHomeWp(0, 1, 45, even)).toBeLessThan(level);
    expect(mlsInMatchHomeWp(2, 0, 0, even)).toBeCloseTo(1, 6);
    expect(mlsInMatchHomeWp(0, 0, 0, even)).toBeCloseTo(0, 6);
  });
});

describe('a league match without a shootout (761829, 2-2)', () => {
  const league: CanonicalGame = {
    ...cup,
    providerGameId: '761829',
    season: 2026,
    seasonKey: 'mls:2026',
    seasonLabel: '2026',
    gameType: 'regular',
    scheduledStart: '2026-09-20T23:00:00Z',
    homeProviderTeamId: '20232',
    awayProviderTeamId: '22529',
    homeScore: 2,
    awayScore: 2,
    isTie: true,
    winnerProviderTeamId: null,
    decisionMethod: 'regulation',
    homeShootoutScore: null,
    awayShootoutScore: null,
  };
  it('ends level with the line at zero (the home side did not win) and names Messi and Dreyer', () => {
    const detail = parseMlsSummaryDetail(summaryOf('761829'), league);
    expect(detail.timeline.map((t) => t.scorerName)).toEqual(['Anders Dreyer', 'Lionel Messi', 'Luis Suárez', 'Anders Dreyer']);
    const { points } = buildMlsStory(detail, { homeName: 'Inter Miami', awayName: 'San Diego' }, null, null);
    expect(points.at(-1)!.homeWp).toBe(0);
    expect(detectMlsMoments(detail)).toEqual([]);
  });
  it('locks the pledge at the first goal by its wall clock, and ends the match by the last one', () => {
    const detail = parseMlsSummaryDetail(summaryOf('761829'), league);
    if (detail.plays.sport !== 'mls') throw new Error('sport');
    const lock = mlsTrueLock(detail.plays.items);
    expect(lock).toEqual({ at: '2026-09-20T23:25:43Z', reliable: true, reason: 'first_score' });
    expect(detail.timestampsReliable).toBe(true);
    expect(detail.finalAt).toBe('2026-09-21T01:15:29.000Z');
    expect(detail.durationMinutes).toBe(122);
  });
});
