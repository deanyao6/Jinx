import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { renderScreen } from '@/test/renderScreen';

import { GameDayScreen } from '../GameDayScreen';

const mockPush = jest.fn();
// Same shape as the tab bar test's mock: the screen only needs useRouter.
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

/**
 * Game day is a demo shell in v1 (SPEC.md 2), so docs/interactions.md sets its minimum at
 * the share icon: the ticket, the companions and the timeline stay inert until the planner
 * is real. This is that minimum.
 */
describe('Game day navigation', () => {
  beforeEach(() => mockPush.mockClear());

  it('opens the game share card from the share icon', async () => {
    const { getByLabelText } = await renderScreen(<GameDayScreen />);
    await fireEvent.press(getByLabelText('Share this game'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/share/[template]',
      params: { template: 'game', payload: expect.any(String) },
    });
    const call = mockPush.mock.calls[0]?.[0] as { params: { payload: string } };
    expect(JSON.parse(call.params.payload)).toMatchObject({
      kind: 'game',
      away: 'Eagles',
      home: 'Rams',
      // Not played yet, so the card draws a dash rather than a score.
      awayScore: null,
      homeScore: null,
      status: 'scheduled',
      venue: 'SoFi Stadium',
      side: 'Eagles',
    });
  });
});
