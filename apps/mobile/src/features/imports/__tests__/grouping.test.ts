import {
  groupImports,
  importBadgeCount,
  importGroup,
  parsedSummary,
  searchPrefill,
  seatLabel,
} from '../grouping';

const row = (
  id: string,
  status: string,
  matched: string | null = null,
  created = '2026-09-15',
) => ({
  id,
  status,
  matched_attendance_id: matched,
  created_at: `${created}T00:00:00Z`,
});

describe('importGroup', () => {
  it('separates matched-unconfirmed from confirmed', () => {
    expect(importGroup(row('a', 'matched'))).toBe('confirm');
    expect(importGroup(row('b', 'matched', 'att-1'))).toBe('done');
  });
  it('maps the other statuses', () => {
    expect(importGroup(row('c', 'needs_review'))).toBe('review');
    expect(importGroup(row('d', 'failed'))).toBe('failed');
    expect(importGroup(row('e', 'pending'))).toBe('processing');
    expect(importGroup(row('f', 'parsed'))).toBe('processing');
    expect(importGroup(row('g', 'discarded'))).toBe('done');
  });
});

describe('groupImports', () => {
  it('buckets and sorts newest first', () => {
    const groups = groupImports([
      row('old', 'needs_review', null, '2026-09-01'),
      row('new', 'needs_review', null, '2026-09-10'),
      row('m', 'matched'),
      row('f', 'failed'),
      row('p', 'pending'),
      row('x', 'discarded'),
    ]);
    expect(groups.review.map((i) => i.id)).toEqual(['new', 'old']);
    expect(groups.confirm.map((i) => i.id)).toEqual(['m']);
    expect(groups.failed.map((i) => i.id)).toEqual(['f']);
    expect(groups.processing.map((i) => i.id)).toEqual(['p']);
    expect(groups.done.map((i) => i.id)).toEqual(['x']);
  });
});

describe('importBadgeCount', () => {
  it('counts pending, needs_review, and matched-unconfirmed only', () => {
    expect(
      importBadgeCount([
        row('a', 'pending'),
        row('b', 'needs_review'),
        row('c', 'matched'),
        row('d', 'matched', 'att'),
        row('e', 'failed'),
        row('f', 'discarded'),
        row('g', 'parsed'),
      ]),
    ).toBe(3);
  });
});

describe('parsed helpers', () => {
  it('summarizes the parsed matchup and seat', () => {
    const p = {
      away_team: 'Mets',
      home_team: 'Phillies',
      date_local: '2026-09-15',
      section: '121',
      row: '14',
      seat: '',
    };
    expect(parsedSummary(p)).toBe('Mets at Phillies, 2026-09-15');
    expect(seatLabel(p)).toBe('Section 121 · Row 14');
    expect(seatLabel({})).toBeNull();
  });
  it('builds a search prefill', () => {
    expect(
      searchPrefill({ away_team: 'Mets', home_team: 'Phillies', date_local: '2026-09-15' }),
    ).toEqual({
      q: 'Mets Phillies',
      date: '2026-09-15',
    });
    expect(searchPrefill({ home_team: 'Phillies', date_local: 'Sept 15' })).toEqual({
      q: 'Phillies',
      date: null,
    });
  });
});
