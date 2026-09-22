import type { ScoringRow } from '@jinx/core';
import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { renderScreen } from '@/test/renderScreen';

import GameDetailScreen from '@/app/games/[gameId]';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ gameId: 'game-chi-phi' }),
  Stack: { Screen: () => null },
}));

jest.mock('@/features/relive/queries', () => ({
  useGameStorySteps: () => ({ data: [], isPending: false }),
  useGameWinProbability: () => ({ data: [], isPending: false }),
}));

/** The timeline read; each test sets what it returns. */
const mockScoring = jest.fn();
/** Bears at Eagles, 2025-11-28 (Dean's own logged game), or the Dodgers game when a test says so. */
const mockGame = jest.fn();

jest.mock('@/features/games/queries', () => {
  const settled = { isPending: false, isError: false, refetch: jest.fn() };
  return {
    useGame: () => ({ data: mockGame(), ...settled }),
    useGameEvents: () => ({ data: [], ...settled }),
    useGameAppearances: () => ({ data: [], ...settled }),
    useGamePlayersSeen: () => ({ data: [], ...settled }),
    useGameScoring: () => ({ data: mockScoring(), ...settled }),
  };
});

const NFL_GAME = {
  id: 'game-chi-phi',
  sport_id: 'nfl',
  status: 'final',
  game_type: 'regular',
  scheduled_start: '2025-11-28T20:00:00Z',
  home_score: 15,
  away_score: 24,
  is_tie: false,
  winner_team_id: 'chi',
  doubleheader_number: null,
  home_team_id: 'phi',
  away_team_id: 'chi',
  home: { id: 'phi', name: 'Philadelphia Eagles', abbreviation: 'PHI' },
  away: { id: 'chi', name: 'Chicago Bears', abbreviation: 'CHI' },
  venue: { id: 'v-linc', name: 'Lincoln Financial Field', city: 'Philadelphia', state: 'PA' },
};

const MLB_GAME = {
  ...NFL_GAME,
  id: 'game-phi-lad',
  sport_id: 'mlb',
  home_score: 6,
  away_score: 9,
  home_team_id: 'lad',
  away_team_id: 'phi',
  home: { id: 'lad', name: 'Los Angeles Dodgers', abbreviation: 'LAD' },
  away: { id: 'phi', name: 'Philadelphia Phillies', abbreviation: 'PHI' },
};

const row = (
  seq: number,
  over: Partial<ScoringRow> & Pick<ScoringRow, 'awayScore' | 'homeScore' | 'scoringSide'>,
): ScoringRow => ({
  seq,
  period: 1,
  half: null,
  clock: null,
  description: '',
  kind: null,
  scorerPlayerId: null,
  scorerName: null,
  ...over,
});

/** The first five scoring plays of Bears at Eagles as the rescore wrote them. */
const CHI_PHI: ScoringRow[] = [
  row(1, {
    period: 1,
    clock: '01:35',
    awayScore: 6,
    homeScore: 0,
    scoringSide: 'away',
    kind: 'touchdown',
    scorerName: "D'Andre Swift",
    scorerPlayerId: 'p-swift',
    description: '(1:35) (Shotgun) 4-D.Swift right guard for 3 yards, TOUCHDOWN.',
  }),
  row(2, {
    period: 1,
    clock: '01:31',
    awayScore: 7,
    homeScore: 0,
    scoringSide: 'away',
    kind: 'extra_point',
    description: '8-C.Santos extra point is GOOD, Center-46-S.Daly, Holder-19-T.Taylor.',
  }),
  row(3, {
    period: 2,
    clock: '13:08',
    awayScore: 7,
    homeScore: 3,
    scoringSide: 'home',
    kind: 'field_goal',
    scorerName: 'Jake Elliott',
    scorerPlayerId: 'p-elliott',
    description:
      '(13:08) 4-J.Elliott 44 yard field goal is GOOD, Center-57-C.Adomitis, Holder-10-B.Mann.',
  }),
  row(4, {
    period: 2,
    clock: '06:47',
    awayScore: 10,
    homeScore: 3,
    scoringSide: 'away',
    kind: 'field_goal',
    scorerName: 'Cairo Santos',
    scorerPlayerId: 'p-santos',
    description:
      '(6:47) 8-C.Santos 30 yard field goal is GOOD, Center-46-S.Daly, Holder-19-T.Taylor.',
  }),
  row(5, {
    period: 3,
    clock: '08:11',
    awayScore: 10,
    homeScore: 9,
    scoringSide: 'home',
    kind: 'touchdown',
    scorerName: 'A.J. Brown',
    scorerPlayerId: 'p-brown',
    description:
      '(8:11) (No Huddle, Shotgun) 1-J.Hurts pass deep left to 11-A.Brown for 33 yards, TOUCHDOWN.',
  }),
];

/** Phillies at Dodgers, 2025-09-17: nine scoring plays, so the list folds. */
const PHI_LAD: ScoringRow[] = [
  row(1, {
    period: 2,
    half: 'bottom',
    awayScore: 0,
    homeScore: 1,
    scoringSide: 'home',
    kind: 'home_run',
    scorerName: 'Alex Call',
  }),
  row(2, {
    period: 2,
    half: 'bottom',
    awayScore: 0,
    homeScore: 3,
    scoringSide: 'home',
    kind: 'home_run',
    scorerName: 'Enrique Hernández',
  }),
  row(3, {
    period: 4,
    half: 'bottom',
    awayScore: 0,
    homeScore: 4,
    scoringSide: 'home',
    kind: 'sac_fly',
    scorerName: 'Enrique Hernández',
  }),
  row(4, {
    period: 6,
    half: 'top',
    awayScore: 2,
    homeScore: 4,
    scoringSide: 'away',
    kind: 'double',
    scorerName: 'Bryce Harper',
  }),
  row(5, {
    period: 6,
    half: 'top',
    awayScore: 5,
    homeScore: 4,
    scoringSide: 'away',
    kind: 'home_run',
    scorerName: 'Brandon Marsh',
  }),
  row(6, {
    period: 6,
    half: 'top',
    awayScore: 6,
    homeScore: 4,
    scoringSide: 'away',
    kind: 'home_run',
    scorerName: 'Max Kepler',
  }),
  row(7, {
    period: 8,
    half: 'bottom',
    awayScore: 6,
    homeScore: 5,
    scoringSide: 'home',
    kind: 'home_run',
    scorerName: 'Shohei Ohtani',
  }),
  row(8, {
    period: 8,
    half: 'bottom',
    awayScore: 6,
    homeScore: 6,
    scoringSide: 'home',
    kind: 'sac_fly',
    scorerName: 'Alex Call',
  }),
  row(9, {
    period: 9,
    half: 'top',
    awayScore: 9,
    homeScore: 6,
    scoringSide: 'away',
    kind: 'home_run',
    scorerName: 'Rafael Marchán',
  }),
];

describe('the Scoring section on game detail', () => {
  beforeEach(() => {
    mockGame.mockReturnValue(NFL_GAME);
    mockScoring.mockReturnValue([]);
  });

  it('shows nothing for a game with no timeline yet', async () => {
    const { queryByText, queryByTestId } = await renderScreen(<GameDetailScreen />);
    expect(queryByText('Scoring')).toBeNull();
    expect(queryByTestId('scoring-section')).toBeNull();
  });

  it('names the touchdown scorer and the field goal kicker, and folds the extra point into the touchdown', async () => {
    mockScoring.mockReturnValue(CHI_PHI);
    const { getByText, queryByText, getAllByText } = await renderScreen(<GameDetailScreen />);
    expect(getByText('Scoring')).toBeTruthy();
    expect(getByText("Touchdown, D'Andre Swift")).toBeTruthy();
    // The PAT is a quiet suffix on the touchdown line, not a line of its own, and the line's
    // score is the score after it.
    expect(getByText('PAT good')).toBeTruthy();
    expect(queryByText(/Cairo Santos extra point|Extra point/)).toBeNull();
    expect(getByText('7 – 0')).toBeTruthy();
    expect(queryByText('6 – 0')).toBeNull();
    expect(getByText('44-yard field goal, Jake Elliott')).toBeTruthy();
    expect(getByText('30-yard field goal, Cairo Santos')).toBeTruthy();
    expect(getByText('Touchdown, A.J. Brown')).toBeTruthy();
    expect(getByText('Q1 1:35')).toBeTruthy();
    expect(getByText('Q3 8:11')).toBeTruthy();
    // Four lines from five rows.
    expect(getAllByText(/^Q\d /)).toHaveLength(4);
  });

  it('says the baseball event with the runs, and folds a long list behind Show all', async () => {
    mockGame.mockReturnValue(MLB_GAME);
    mockScoring.mockReturnValue(PHI_LAD);
    const { getByText, getAllByText, queryByText } = await renderScreen(<GameDetailScreen />);
    expect(getByText('Home run, Alex Call')).toBeTruthy();
    expect(getByText('2-run home run, Enrique Hernández')).toBeTruthy();
    expect(getByText('Sacrifice fly, Enrique Hernández')).toBeTruthy();
    expect(getByText('2-run double, Bryce Harper')).toBeTruthy();
    expect(getByText('3-run home run, Brandon Marsh')).toBeTruthy();
    expect(getAllByText('Bot 2nd')).toHaveLength(2);
    expect(getAllByText('Top 6th')).toHaveLength(3);
    // Six shown, three behind the button.
    expect(queryByText('Home run, Shohei Ohtani')).toBeNull();
    await fireEvent.press(getByText('Show all 9'));
    expect(getByText('Home run, Shohei Ohtani')).toBeTruthy();
    expect(getByText('3-run home run, Rafael Marchán')).toBeTruthy();
    expect(getByText('9 – 6')).toBeTruthy();
    await fireEvent.press(getByText('Show fewer'));
    expect(queryByText('Home run, Shohei Ohtani')).toBeNull();
  });
});
