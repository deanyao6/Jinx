import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { renderScreen } from '@/test/renderScreen';

import GameDetailScreen from '@/app/(tabs)/(feed,passport,games,plan,profile)/games/[gameId]';

const GAME_ID = 'game-chi-phi';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ gameId: 'game-chi-phi' }),
  Stack: { Screen: () => null },
}));

/** The four reads the screen makes. Each test decides what the last one returns. */
const mockStorySteps = jest.fn();
jest.mock('@/features/relive/queries', () => ({
  useGameStorySteps: () => mockStorySteps(),
  useGameWinProbability: () => ({ data: [], isPending: false }),
}));

/**
 * Bears at Eagles, Lincoln Financial Field — Dean's own logged game, which is the one the
 * entry point had to work on.
 *
 * Built inside the factory rather than referenced from module scope: jest hoists
 * `jest.mock` above every `const` in the file, so a factory that closes over one reads it
 * before it is assigned and the screen silently renders its "could not load" branch.
 */
jest.mock('@/features/games/queries', () => {
  const game = {
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
  const settled = { isPending: false, isError: false, refetch: jest.fn() };
  return {
    useGame: () => ({ data: game, ...settled }),
    useGameEvents: () => ({ data: [], ...settled }),
    useGameAppearances: () => ({ data: [], ...settled }),
    useGamePlayersSeen: () => ({ data: [], ...settled }),
    useGameScoring: () => ({ data: [], ...settled }),
  };
});

/**
 * The bug this covers: `/relive/[gameId]` was a valid route that NOTHING in the app linked
 * to, so the feature was unreachable however much data was behind it. Game detail is the
 * entry point docs/interactions.md asks for.
 */
describe('the Relive entry point', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockStorySteps.mockReturnValue({ data: [], isPending: false });
  });

  it('offers Relive when the game has a story', async () => {
    mockStorySteps.mockReturnValue({
      data: [{ wp: 1, score: '0 – 0', label: 'Pregame', text: 'Eagles were 57% to win.' }],
      isPending: false,
    });
    const { getByText } = await renderScreen(<GameDetailScreen />);
    await fireEvent.press(getByText('Relive this game'));
    expect(mockPush).toHaveBeenCalledWith(`/relive/${GAME_ID}`);
  });

  it('does not offer it for a game whose play-by-play has not been ingested', async () => {
    // Better to show nothing than a button that opens onto "nothing to relive".
    const { queryByText } = await renderScreen(<GameDetailScreen />);
    expect(queryByText('Relive this game')).toBeNull();
  });

  it('links to the stadium guide, which was also unreachable', async () => {
    const { getByText } = await renderScreen(<GameDetailScreen />);
    await fireEvent.press(getByText('Guide to Lincoln Financial Field'));
    expect(mockPush).toHaveBeenCalledWith('/guide/v-linc');
  });
});
