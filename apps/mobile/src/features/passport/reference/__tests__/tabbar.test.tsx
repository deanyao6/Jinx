import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { renderScreen } from '@/test/renderScreen';

import { PassportScreen } from '../PassportScreen';

const mockReplace = jest.fn();
// Minimal: the bar only needs useRouter. Pulling in the real module drags the whole
// router runtime into a unit test for four buttons.
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

/**
 * Each ported screen draws the reference's own tab bar rather than the navigator's, so
 * the bar itself has to navigate. It shipped as four plain views with no press handler,
 * which left the app with no way to move between tabs at all. Rendered through a real
 * screen because the bar reads the team theme its parent provides.
 */
describe('TabBar', () => {
  beforeEach(() => mockReplace.mockClear());

  it.each([
    ['Games', '/games'],
    ['Plan', '/plan'],
    ['Profile', '/profile'],
  ])('navigates to %s', async (label, route) => {
    const { getByLabelText } = await renderScreen(<PassportScreen />);
    await fireEvent.press(getByLabelText(label));
    expect(mockReplace).toHaveBeenCalledWith(route);
  });

  it('stays put when the tab you are already on is pressed', async () => {
    const { getByLabelText } = await renderScreen(<PassportScreen />);
    await fireEvent.press(getByLabelText('Passport'));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
