import { rosterMeta } from '../meta';

/**
 * The line under a name in the player picker.
 *
 * The first draft read "5 games recorded", which is a fact about the database and not about
 * you: it counts every game we have ingested for that team. A fan reading it on their own
 * team's roster would fairly take it to mean "you saw them five times". So the seen count
 * leads whenever there is one, and the other number is only shown when there is nothing
 * better to say.
 */
describe('rosterMeta', () => {
  it('leads with what you saw', () => {
    expect(rosterMeta({ seen_by_you: 1, appearances: 5 })).toBe('Seen once');
    expect(rosterMeta({ seen_by_you: 4, appearances: 5 })).toBe('Seen 4 times');
  });

  it('never says "seen 1 times"', () => {
    expect(rosterMeta({ seen_by_you: 1, appearances: 99 })).not.toContain('1 times');
  });

  it('falls back to the record only when you have not seen them', () => {
    expect(rosterMeta({ seen_by_you: 0, appearances: 5 })).toBe('In 5 games on record');
    expect(rosterMeta({ seen_by_you: 0, appearances: 1 })).toBe('In 1 game on record');
  });

  it('does not claim you saw someone you did not', () => {
    // The whole point of splitting the two counts: a player with 300 appearances and no
    // overlap with your games must not read as anything you were there for.
    expect(rosterMeta({ seen_by_you: 0, appearances: 300 })).not.toMatch(/seen/i);
  });
});
