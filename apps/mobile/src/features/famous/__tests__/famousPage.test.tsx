import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { renderScreen } from '@/test/renderScreen';

import FamousGamesScreen from '@/app/(tabs)/(passport)/passport/famous';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  Stack: { Screen: () => null },
}));

const mockData = jest.fn();
jest.mock('@/features/famous/queries', () => ({
  useMyFamousGames: () => ({
    data: mockData(),
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));

const row = (over: Record<string, unknown>) => ({
  gameId: 'g-sb59',
  source: 'curated',
  category: 'championship',
  kind: 'curated',
  title: 'Super Bowl LIX',
  story: '',
  personal: false,
  playerName: null,
  teamId: 'phi',
  teamNickname: 'Eagles',
  sportId: 'nfl',
  scheduledStart: '2025-02-09T23:30:00Z',
  away: 'KC',
  home: 'PHI',
  awayScore: 22,
  homeScore: 40,
  ...over,
});

describe('the famous games page', () => {
  beforeEach(() => mockPush.mockReset());

  it('says what counts when there is nothing yet', async () => {
    mockData.mockReturnValue([]);
    const { getByText } = await renderScreen(<FamousGamesScreen />);
    expect(getByText('No famous games yet')).toBeTruthy();
    expect(getByText(/Championships/)).toBeTruthy();
  });

  it('opens on the count, groups by league and team, and each row opens its game', async () => {
    mockData.mockReturnValue([
      row({}),
      row({
        gameId: 'g-duran',
        source: 'personal',
        kind: 'first_days',
        personal: true,
        playerName: 'Jhoan Duran',
        teamId: 'phi-mlb',
        teamNickname: 'Phillies',
        sportId: 'mlb',
        scheduledStart: '2025-08-01T23:05:00Z',
        away: 'DET',
        home: 'PHI',
      }),
    ]);
    const { getByText, getByLabelText } = await renderScreen(<FamousGamesScreen />);
    expect(getByText('2')).toBeTruthy();
    expect(getByText(/1 personal badge/)).toBeTruthy();
    expect(getByText('MLB')).toBeTruthy();
    expect(getByText('NFL')).toBeTruthy();
    fireEvent.press(getByLabelText('Super Bowl LIX, KC 22 at PHI 40'));
    expect(mockPush).toHaveBeenCalledWith('/games/g-sb59');
    expect(getByText('Saw Jhoan Duran’s first days as a Phillie')).toBeTruthy();
  });
});
