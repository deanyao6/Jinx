import { personalLine, withPersonalLine } from '../personal';

describe('personalLine', () => {
  it('leads with the companion record, as the spec example does', () => {
    expect(
      personalLine({
        result: 'win',
        companion: { name: 'Dad', wins: 7, losses: 1, ties: 0 },
        overall: { wins: 31, losses: 17, ties: 0 },
      }),
    ).toBe('Your record with Dad is 7–1.');
  });

  it('falls back to the overall record', () => {
    expect(
      personalLine({ result: 'loss', companion: null, overall: { wins: 31, losses: 17, ties: 0 } }),
    ).toBe('You are 31–17 at games you attend.');
    expect(
      personalLine({ result: 'win', companion: null, overall: { wins: 6, losses: 2, ties: 1 } }),
    ).toBe('You were there for the win. You are 6–2–1 at games you attend.');
  });

  it('says nothing rather than quote an empty record', () => {
    expect(
      personalLine({
        result: null,
        companion: { name: 'Dad', wins: 0, losses: 0, ties: 0 },
        overall: { wins: 0, losses: 0, ties: 0 },
      }),
    ).toBeNull();
    expect(personalLine({ result: null, companion: null, overall: null })).toBeNull();
  });
});

describe('withPersonalLine', () => {
  const steps = [{ text: 'Pregame.' }, { text: 'Giants win 5–2.' }];

  it('touches only the final step', () => {
    expect(withPersonalLine(steps, 'You are 3–1 at games you attend.')).toEqual([
      { text: 'Pregame.' },
      { text: 'Giants win 5–2. You are 3–1 at games you attend.' },
    ]);
  });

  it('leaves the story alone when there is nothing personal to say', () => {
    expect(withPersonalLine(steps, null)).toEqual(steps);
    expect(withPersonalLine([], 'x')).toEqual([]);
  });
});
