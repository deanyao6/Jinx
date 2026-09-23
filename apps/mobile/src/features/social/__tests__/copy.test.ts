import { numberWords, ordinal, overlapSentence, recordText, recordTone, rivalLabel } from '../copy';

describe('numberWords and ordinal', () => {
  it('spells out zero through twenty and leaves larger numbers as digits', () => {
    expect(numberWords(0)).toBe('zero');
    expect(numberWords(1)).toBe('one');
    expect(numberWords(11)).toBe('eleven');
    expect(numberWords(20)).toBe('twenty');
    expect(numberWords(21)).toBe('21');
    expect(numberWords(104)).toBe('104');
  });

  it('builds ordinals including the teens', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
    expect(ordinal(22)).toBe('22nd');
    expect(ordinal(50)).toBe('50th');
    expect(ordinal(100)).toBe('100th');
  });
});

describe('overlapSentence', () => {
  const row = {
    other_display_name: 'Maya',
    other_handle: 'maya',
    home_team_name: 'Phillies',
    away_team_name: 'Mets',
    scheduled_start: '2019-08-10T23:05:00Z',
    section_gap: 11,
  };

  it('spells out the section gap', () => {
    expect(overlapSentence(row)).toBe(
      'You and Maya were both at Phillies vs Mets in August 2019, eleven sections apart.',
    );
  });

  it('omits the gap when seats are not shared and handles same/one section', () => {
    expect(overlapSentence({ ...row, section_gap: null })).toBe(
      'You and Maya were both at Phillies vs Mets in August 2019.',
    );
    expect(overlapSentence({ ...row, section_gap: 0 })).toMatch(/, in the same section\.$/);
    expect(overlapSentence({ ...row, section_gap: 1 })).toMatch(/, one section apart\.$/);
    expect(overlapSentence({ ...row, section_gap: 33 })).toMatch(/, 33 sections apart\.$/);
  });

  it('falls back to the handle', () => {
    expect(overlapSentence({ ...row, other_display_name: null })).toMatch(/^You and @maya were/);
  });
});

describe('records and rival labels', () => {
  it('formats records and tones', () => {
    expect(recordText(7, 1)).toBe('7–1');
    expect(recordText(4, 2, 1)).toBe('4–2–1');
    expect(recordTone(7, 1)).toBe('good');
    expect(recordTone(0, 4)).toBe('bad');
    expect(recordTone(2, 2)).toBe('even');
    expect(recordTone(0, 0)).toBe('even');
  });

  it('labels rivals by their teams', () => {
    expect(rivalLabel('Jordan', [])).toBe('Jordan');
    expect(rivalLabel('Jordan', ['Cowboys'])).toBe('Jordan, Cowboys fan');
    expect(rivalLabel('Jordan', ['Cowboys', 'Rangers'])).toBe('Jordan, Cowboys and Rangers fan');
  });
});
