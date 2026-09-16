import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { renderScreen } from '@/test/renderScreen';

import { StadiumGuideScreen } from '../StadiumGuideScreen';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
// Same shape as the tab bar test's mock: the screen only needs useRouter.
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    canGoBack: mockCanGoBack,
  }),
}));

/**
 * The Stadium guide's two chrome controls, wired per docs/interactions.md. The category
 * tabs already worked and are covered by interactions.test.tsx; the hero and the guide rows
 * stay inert while the guide is a demo shell.
 */
describe('Stadium guide navigation', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
    mockCanGoBack.mockClear().mockReturnValue(true);
  });

  // The escape hatch: the tab bar was the only way off this screen.
  it('pops back from the chevron', async () => {
    const { getByLabelText } = await renderScreen(<StadiumGuideScreen />);
    await fireEvent.press(getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falls back to the Passport when there is no history to pop', async () => {
    mockCanGoBack.mockReturnValue(false);
    const { getByLabelText } = await renderScreen(<StadiumGuideScreen />);
    await fireEvent.press(getByLabelText('Back'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  /** There is no "guide" template; a venue's card in the sheet is the stamp. */
  it('opens the stamp share card from the share icon', async () => {
    const { getByLabelText } = await renderScreen(<StadiumGuideScreen />);
    await fireEvent.press(getByLabelText('Share this stadium'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/share/[template]',
      params: { template: 'stamp', payload: expect.any(String) },
    });
    const call = mockPush.mock.calls[0]?.[0] as { params: { payload: string } };
    expect(JSON.parse(call.params.payload)).toMatchObject({
      kind: 'stamp',
      venue: 'Citizens Bank Park',
      place: 'Philadelphia, home of the Phillies',
    });
  });
});
