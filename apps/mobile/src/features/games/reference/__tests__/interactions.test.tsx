import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { renderScreen } from '@/test/renderScreen';

import { GamesScreen } from '../GamesScreen';

const mockPush = jest.fn();
// Minimal, as in passport/reference/__tests__/tabbar.test.tsx: the screen only needs
// useRouter, and the real module drags the whole router runtime into a unit test.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

// One of the demo fixtures' rows. Every date in them is in the past, which is what makes
// the History / Upcoming split observable at all.
const A_GAME = 'Yankees 4, Red Sox 6';
/** The row's real game id, now that GameRowFixture carries one. */
const A_GAME_ID = 'demo-yankees-red-2024-06-15';
const A_GAME_LABEL = `${A_GAME}, Fenway Park, Jun 15, 2024`;

describe('Games interactions', () => {
  beforeEach(() => mockPush.mockClear());

  describe('segments', () => {
    it('shows the attended games under History', async () => {
      const { getByText } = await renderScreen(<GamesScreen />);
      expect(getByText(A_GAME)).toBeTruthy();
      expect(getByText('Mets 3, Phillies 5')).toBeTruthy();
    });

    it('does not show history rows under Upcoming', async () => {
      const { getByLabelText, queryByText } = await renderScreen(<GamesScreen />);
      await fireEvent.press(getByLabelText('Upcoming'));
      // The bug this replaces: the segment changed and the same five rows stayed.
      expect(queryByText(A_GAME)).toBeNull();
      expect(queryByText('Mets 3, Phillies 5')).toBeNull();
      expect(queryByText(/Nothing coming up/)).toBeTruthy();
    });

    it('opens the imports inbox from the Imports segment', async () => {
      const { getByLabelText } = await renderScreen(<GamesScreen />);
      await fireEvent.press(getByLabelText('Imports'));
      expect(mockPush).toHaveBeenCalledWith('/games/imports');
    });

    it('offers the imports inbox again from the pane behind it', async () => {
      const { getByLabelText } = await renderScreen(<GamesScreen />);
      await fireEvent.press(getByLabelText('Imports'));
      mockPush.mockClear();
      await fireEvent.press(getByLabelText('Open imports'));
      expect(mockPush).toHaveBeenCalledWith('/games/imports');
    });
  });

  describe('search', () => {
    it('filters the list by venue', async () => {
      const { getByLabelText, getByText, queryByText } = await renderScreen(<GamesScreen />);
      await fireEvent.changeText(getByLabelText('Search games'), 'fenway');
      expect(getByText(A_GAME)).toBeTruthy();
      expect(queryByText('Mets 3, Phillies 5')).toBeNull();
    });

    it('filters by who you were with', async () => {
      const { getByText, getByLabelText, queryByText } = await renderScreen(<GamesScreen />);
      await fireEvent.changeText(getByLabelText('Search games'), 'Dad');
      expect(getByText('Chiefs 31, Raiders 17')).toBeTruthy();
      expect(queryByText(A_GAME)).toBeNull();
    });

    it('says so when nothing matches', async () => {
      const { getByLabelText, queryByText } = await renderScreen(<GamesScreen />);
      await fireEvent.changeText(getByLabelText('Search games'), 'zzz');
      expect(queryByText('No games match "zzz".')).toBeTruthy();
    });
  });

  describe('the add menu', () => {
    it.each([
      ['Log a game', '/legacy-games?segment=log'],
      ['Log a season', '/games/bulk'],
      ['Upload tickets', '/games/import'],
    ])('offers %s', async (label, route) => {
      const { getByLabelText } = await renderScreen(<GamesScreen />);
      await fireEvent.press(getByLabelText('Add games'));
      await fireEvent.press(getByLabelText(label));
      expect(mockPush).toHaveBeenCalledWith(route);
    });

    it('closes without navigating when the backdrop is pressed', async () => {
      const { getByLabelText, queryByLabelText } = await renderScreen(<GamesScreen />);
      await fireEvent.press(getByLabelText('Add games'));
      await fireEvent.press(getByLabelText('Close menu'));
      expect(queryByLabelText('Log a season')).toBeNull();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('game rows', () => {
    it('opens game detail', async () => {
      const { getByLabelText } = await renderScreen(<GamesScreen />);
      await fireEvent.press(getByLabelText(A_GAME_LABEL));
      expect(mockPush).toHaveBeenCalledWith(`/games/${A_GAME_ID}`);
    });
  });
});
