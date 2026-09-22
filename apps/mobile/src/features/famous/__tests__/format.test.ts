import {
  famousKicker,
  famousStory,
  famousTitle,
  groupFamous,
  leagueLabel,
  type FamousListItem,
} from '../format';

const item = (over: Partial<FamousListItem>): FamousListItem => ({
  gameId: 'g',
  source: 'curated',
  category: 'championship',
  kind: 'curated',
  title: 'Super Bowl LIX',
  story: 'The Eagles beat the Chiefs.',
  personal: false,
  playerName: null,
  teamId: 'phi-nfl',
  teamNickname: 'Eagles',
  sportId: 'nfl',
  scheduledStart: '2025-02-09T23:30:00Z',
  away: 'KC',
  home: 'PHI',
  awayScore: 22,
  homeScore: 40,
  ...over,
});

describe('famous titles and kickers', () => {
  it('keeps a famous row’s own title and story', () => {
    expect(famousTitle(item({}))).toBe('Super Bowl LIX');
    expect(famousStory(item({}))).toBe('The Eagles beat the Chiefs.');
    expect(famousKicker(item({}))).toBe('Championship');
  });
  it('builds a personal badge’s sentence and says it is yours', () => {
    const badge = item({
      personal: true,
      kind: 'first_days',
      playerName: 'Jhoan Duran',
      teamNickname: 'Phillies',
      sportId: 'mlb',
    });
    expect(famousTitle(badge)).toBe('Saw Jhoan Duran’s first days as a Phillie');
    expect(famousKicker(badge)).toBe('Yours');
    expect(famousStory(badge)).toMatch(/within 14 days/);
    expect(famousTitle({ ...badge, kind: 'debut', playerName: 'Bryce Harper' })).toBe(
      'Saw Bryce Harper’s MLB debut',
    );
  });
});

describe('groupFamous', () => {
  it('groups by league, then team, newest first', () => {
    const groups = groupFamous([
      item({ gameId: 'a', scheduledStart: '2018-02-04T23:31:00Z', title: 'Super Bowl LII' }),
      item({ gameId: 'b' }),
      item({
        gameId: 'c',
        sportId: 'mlb',
        teamId: 'phi-mlb',
        teamNickname: 'Phillies',
        title: 'NLCS Game 5',
        scheduledStart: '2022-10-23T18:37:00Z',
      }),
      item({
        gameId: 'd',
        teamId: 'kc',
        teamNickname: 'Chiefs',
        title: 'Thirteen seconds',
        scheduledStart: '2022-01-23T23:30:00Z',
      }),
    ]);
    expect(groups.map((g) => g.title)).toEqual(['MLB', 'NFL']);
    const nfl = groups[1]!;
    expect(nfl.teams.map((t) => t.title)).toEqual(['Eagles', 'Chiefs']);
    expect(nfl.teams[0]!.items.map((i) => i.title)).toEqual(['Super Bowl LIX', 'Super Bowl LII']);
  });
  it('names a league it has no label for by its id', () => {
    expect(leagueLabel('nhl')).toBe('NHL');
  });
});
