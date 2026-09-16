import { evaluateGoal, type GoalGame } from '@jinx/core';

import {
  buildCustomGoal,
  buildSuggestedGoal,
  buildTemplateGoal,
  customGoalTitle,
  progressLabel,
  sameDefinition,
} from '../builder';

describe('buildTemplateGoal', () => {
  it('turns "attend N games" into a count predicate for the year', () => {
    const draft = buildTemplateGoal('attend_n', 20, 2026);
    expect(draft).toEqual({
      title: 'Attend 20 games',
      source: 'template',
      definition: { type: 'count', target: 20, filter: { year: 2026 } },
    });
  });

  it('uses the favorite franchise for "see your team on the road"', () => {
    const draft = buildTemplateGoal('team_on_road', 99, 2026, { favoriteFranchiseId: 'mlb-143' });
    expect(draft?.definition).toEqual({
      type: 'exists',
      filter: { year: 2026, venue_not_home: true, team: 'mlb-143' },
    });
    expect(draft?.title).toBe('See your team on the road');
  });

  it('rejects unknown templates and clamps N to at least 1', () => {
    expect(buildTemplateGoal('nope', 3, 2026)).toBeNull();
    expect(buildTemplateGoal('new_stadiums', 0, 2026)?.definition).toEqual({
      type: 'distinct_venues',
      target: 1,
      filter: { year: 2026, new_venue: true },
    });
  });
});

describe('buildSuggestedGoal', () => {
  it('suggests about 25% more than last year', () => {
    const draft = buildSuggestedGoal(14, 2026);
    expect(draft?.source).toBe('suggested');
    expect(draft?.definition).toEqual({ type: 'count', target: 18, filter: { year: 2026 } });
    expect(buildSuggestedGoal(0, 2026)).toBeNull();
  });
});

describe('buildCustomGoal', () => {
  it('builds a distinct_venues goal with sport, event, team and road filters', () => {
    const input = {
      type: 'distinct_venues' as const,
      target: 5,
      sport: 'mlb' as const,
      event: 'home_run',
      team: 'mlb-143',
      teamName: 'Philadelphia Phillies',
      road: true,
      newVenue: false,
    };
    const draft = buildCustomGoal(input, 2026);
    expect(draft?.definition).toEqual({
      type: 'distinct_venues',
      target: 5,
      filter: {
        year: 2026,
        sport: 'mlb',
        event: 'home_run',
        team: 'mlb-143',
        venue_not_home: true,
      },
    });
    expect(draft?.title).toBe(customGoalTitle(input));
    expect(draft?.title).toContain('home run');
    expect(buildCustomGoal(input, 2026, '  My HR tour ')?.title).toBe('My HR tour');
  });

  it('builds an exists goal without a target and evaluates with core', () => {
    const draft = buildCustomGoal(
      {
        type: 'exists',
        target: 1,
        sport: null,
        event: 'walk_off',
        team: null,
        road: false,
        newVenue: false,
      },
      2026,
    );
    expect(draft?.definition).toEqual({
      type: 'exists',
      filter: { year: 2026, event: 'walk_off' },
    });
    const game: GoalGame = {
      gameId: 'g1',
      sport: 'mlb',
      scheduledStart: '2026-06-01T23:05:00Z',
      year: 2026,
      venueId: 'v1',
      homeTeamId: 'h',
      awayTeamId: 'a',
      homeFranchiseId: 'fh',
      awayFranchiseId: 'fa',
      rootingTeamId: 'h',
      rootingFranchiseId: 'fh',
      rootingBasis: 'favorite',
      result: 'win',
      events: ['walk_off'],
      companions: [],
      isNewVenue: true,
      isFinal: true,
    };
    const progress = evaluateGoal(draft!.definition, [game]);
    expect(progress.completed).toBe(true);
    expect(progressLabel(progress, draft!.definition)).toBe('Done');
    expect(progressLabel({ current: 0, target: 1, completed: false }, draft!.definition)).toBe(
      'Not yet',
    );
    expect(
      progressLabel({ current: 3, target: 5, completed: false }, { type: 'count', target: 5 }),
    ).toBe('3 of 5');
  });
});

describe('sameDefinition', () => {
  it('ignores key order', () => {
    expect(
      sameDefinition(
        { type: 'count', target: 18, filter: { year: 2026 } },
        { filter: { year: 2026 }, target: 18, type: 'count' },
      ),
    ).toBe(true);
    expect(sameDefinition({ type: 'count', target: 18 }, { type: 'count', target: 19 })).toBe(
      false,
    );
  });
});
