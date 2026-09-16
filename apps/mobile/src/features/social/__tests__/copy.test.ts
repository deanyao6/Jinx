import {
  feedEventCopy,
  numberWords,
  ordinal,
  overlapSentence,
  recordText,
  recordTone,
  rivalLabel,
  type FeedEvent,
} from '../copy';

const base: FeedEvent = {
  id: 'e1',
  actor_user_id: 'u2',
  actor_handle: 'maya',
  actor_display_name: 'Maya',
  type: 'logged_game',
  game_id: 'g1',
  payload: {},
  created_at: '2026-09-01T00:00:00Z',
  game: {
    sport_id: 'mlb',
    scheduled_start: '2019-08-10T23:05:00Z',
    status: 'final',
    home: 'Phillies',
    away: 'Mets',
    home_score: 5,
    away_score: 2,
    venue: 'Citizens Bank Park',
  },
  reactions: {},
  my_reaction: null,
};

describe('feedEventCopy', () => {
  it('describes a logged game with the winner first and the venue', () => {
    expect(feedEventCopy(base)).toBe('Maya logged Phillies 5, Mets 2 at Citizens Bank Park');
    expect(feedEventCopy({ ...base, game: { ...base.game!, home_score: 1, away_score: 4 } })).toBe(
      'Maya logged Mets 4, Phillies 1 at Citizens Bank Park',
    );
  });

  it('falls back to the matchup for games without a final score', () => {
    expect(
      feedEventCopy({
        ...base,
        game: { ...base.game!, status: 'scheduled', home_score: null, away_score: null },
      }),
    ).toBe('Maya logged Mets at Phillies at Citizens Bank Park');
    expect(feedEventCopy({ ...base, game: null })).toBe('Maya logged a game');
  });

  it('uses the handle when there is no display name', () => {
    expect(feedEventCopy({ ...base, actor_display_name: '', game: null })).toBe(
      '@maya logged a game',
    );
  });

  it('covers pledges, stamps, goals, milestones, and Wrapped', () => {
    expect(
      feedEventCopy({
        ...base,
        actor_display_name: 'Jordan',
        type: 'pledge_won',
        payload: { team_name: 'Bears', result: 'win' },
      }),
    ).toBe('Jordan’s pledge to the Bears won');
    expect(feedEventCopy({ ...base, type: 'pledge_lost', payload: { team_name: 'Bears' } })).toBe(
      'Maya’s pledge to the Bears lost',
    );
    expect(
      feedEventCopy({ ...base, type: 'new_stamp', payload: { venue_name: 'Wrigley Field' } }),
    ).toBe('New stamp: Wrigley Field');
    expect(
      feedEventCopy({
        ...base,
        type: 'goal_completed',
        game: null,
        payload: { title: 'Home runs in 5 ballparks' },
      }),
    ).toBe('Goal completed: Home runs in 5 ballparks');
    expect(feedEventCopy({ ...base, type: 'milestone', payload: { games: 50 } })).toBe('50th game');
    expect(
      feedEventCopy({
        ...base,
        type: 'wrapped_published',
        game: null,
        payload: { season: 2026, sport_id: 'mlb' },
      }),
    ).toBe('2026 MLB Wrapped is ready');
  });
});

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
