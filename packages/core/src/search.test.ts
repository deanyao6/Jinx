import { describe, expect, it } from 'vitest';
import { normalizeSearch, parseSearch, resolveSearch, type SearchCandidate } from './search.js';

const candidate = (
  phrase: string,
  id = phrase,
  tier = 0,
  kind: 'team' | 'venue' = 'team',
): SearchCandidate => ({
  phrase,
  id,
  tier,
  kind,
  quality: tier === 2 ? 600 : 1000,
  name: id,
  label: id,
  alias: phrase,
});

describe('search dates and normalization', () => {
  it('normalizes accents and punctuation', () => {
    expect(normalizeSearch('  CF MONTRÉAL / D.C.  ')).toBe('cf montreal d c');
  });
  it('extracts calendar years rather than season keys', () => {
    expect(parseSearch('Lakers 2026').filters).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
  it.each(['2025 season', 'season 2025'])('understands explicit season %s', (q) => {
    expect(parseSearch(`NBA ${q}`).filters).toEqual({ sport: 'nba', season: 2025 });
  });
  it.each(['September 2025', 'Sep 2025', 'Sept 2025'])('parses month %s', (q) => {
    expect(parseSearch(`LAFC ${q}`).filters).toEqual({ from: '2025-09-01', to: '2025-09-30' });
  });
  it('handles leap days', () => {
    expect(parseSearch('2024-02-29').filters.from).toBe('2024-02-29');
    expect(parseSearch('2025-02-29').error).toBeTruthy();
    expect(parseSearch('February 2024').filters.to).toBe('2024-02-29');
  });
  it.each([
    '03/04/2025',
    '2025 2026',
    '0001 season',
    '% _',
    '2025-13-01',
    'April 2025 September 2025',
  ])('rejects unsupported or ambiguous input %s', (q) => {
    expect(parseSearch(q).error).toBeTruthy();
  });
  it('rejects conflicting hard filters', () => {
    expect(parseSearch('mls', { sport: 'nba' }).error).toBeTruthy();
    expect(parseSearch('2025', { from: '2024-01-01' }).error).toBeTruthy();
    expect(parseSearch('2025 season', { season: 2024 }).error).toBeTruthy();
    expect(parseSearch('', { from: '2025-04-01', to: '2025-03-01' }).error).toBeTruthy();
  });
  it('caps expensive queries and preserves separators', () => {
    expect(parseSearch('x'.repeat(161)).error).toBeTruthy();
    expect(parseSearch('a '.repeat(11)).error).toBeTruthy();
    expect(parseSearch('Eagles @ Cowboys 2025').words).toEqual(['eagles', 'at', 'cowboys']);
  });
});

describe('entity interpretation', () => {
  it('does not mistake AT&T Stadium for a directional matchup', () => {
    const parsed = parseSearch('AT&T Stadium');
    expect(parsed.phrases).toContain('at t stadium');
    expect(resolveSearch(parsed, [candidate('at t stadium', 'att', 0, 'venue')])[0]?.venueId).toBe(
      'att',
    );
  });
  it('prefers one exact phrase to shorter pieces', () => {
    const plans = resolveSearch(parseSearch('LA Galaxy'), [
      candidate('la galaxy'),
      candidate('la'),
      candidate('galaxy'),
    ]);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.teamIds).toEqual(['la galaxy']);
  });
  it('requires two different teams for a matchup', () => {
    expect(
      resolveSearch(parseSearch('LAFC Galaxy 2025'), [candidate('lafc'), candidate('galaxy')])[0]
        ?.teamIds,
    ).toEqual(['lafc', 'galaxy']);
    expect(
      resolveSearch(parseSearch('LAFC Los Angeles FC'), [
        candidate('lafc', 'same'),
        candidate('los angeles fc', 'same'),
      ]),
    ).toEqual([]);
  });
  it('assigns at direction and keeps vs direction free', () => {
    const aliases = [candidate('eagles'), candidate('cowboys')];
    const at = resolveSearch(parseSearch('Eagles at Cowboys'), aliases)[0];
    expect(at?.awayId).toBe('eagles');
    expect(at?.homeId).toBe('cowboys');
    expect(resolveSearch(parseSearch('Cowboys vs Eagles'), aliases)[0]?.homeId).toBeUndefined();
  });
  it('rejects malformed directional matchups', () => {
    expect(
      resolveSearch(parseSearch('at eagles cowboys'), [candidate('eagles'), candidate('cowboys')]),
    ).toEqual([]);
    expect(resolveSearch(parseSearch('eagles at'), [candidate('eagles')])).toEqual([]);
  });
  it('returns ambiguity rather than picking one Giants team', () => {
    expect(
      resolveSearch(parseSearch('Giants'), [
        candidate('giants', 'mlb'),
        candidate('giants', 'nfl'),
      ]),
    ).toHaveLength(2);
  });
  it('keeps typo candidates below exact aliases', () => {
    const plans = resolveSearch(parseSearch('Phillies'), [
      candidate('phillies', 'correct'),
      candidate('phillies', 'other', 2),
    ]);
    expect(plans.map((p) => p.teamIds)).toEqual([['correct']]);
  });
  it('resolves a fuzzy entity without dropping meaningful unknown words', () => {
    expect(
      resolveSearch(parseSearch('philies'), [candidate('philies', 'phillies', 2)])[0]?.tier,
    ).toBe(2);
    expect(
      resolveSearch(parseSearch('philies birthday'), [candidate('philies', 'phillies', 2)]),
    ).toEqual([]);
  });
  it('can combine teams and a historical venue alias', () => {
    const plans = resolveSearch(parseSearch('Lakers Staples Center 2021'), [
      candidate('lakers'),
      candidate('staples center', 'crypto', 0, 'venue'),
    ]);
    expect(plans[0]?.venueId).toBe('crypto');
  });
  it('handles filter-only searches without entity suggestions', () => {
    expect(resolveSearch(parseSearch('2025'), [])).toHaveLength(1);
  });
});
