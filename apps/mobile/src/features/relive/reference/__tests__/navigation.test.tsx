import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { renderScreen } from '@/test/renderScreen';

import { ReliveScreen } from '../ReliveScreen';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
// Same shape as the tab bar test's mock: the screen only needs useRouter, and the real
// module drags the whole router runtime into a unit test about five controls.
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    canGoBack: mockCanGoBack,
  }),
}));

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
const mockPicker = ImagePicker.launchImageLibraryAsync as jest.Mock;

/**
 * Relive's controls, wired per docs/interactions.md. Every one of these shipped as a plain
 * View, so the parity harness scored the screen full marks with nothing on it working.
 */
describe('Relive navigation', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
    mockCanGoBack.mockClear().mockReturnValue(true);
    mockPicker.mockClear().mockResolvedValue({ canceled: true, assets: null });
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  // The escape hatch: the tab bar was the only way off this screen.
  it('pops back from the chevron', async () => {
    const { getByLabelText } = await renderScreen(<ReliveScreen />);
    await fireEvent.press(getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falls back to Games when there is no history to pop', async () => {
    mockCanGoBack.mockReturnValue(false);
    const { getByLabelText } = await renderScreen(<ReliveScreen />);
    await fireEvent.press(getByLabelText('Back'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/games');
  });

  /**
   * There is no "relive" share template, so Share opens the game card, which is the closest
   * one the sheet actually has. The route needs the payload as well as the name: without it
   * `parseShareTemplate` returns null and the sheet shows its error state.
   */
  it('opens the game share card from the share icon', async () => {
    const { getByLabelText } = await renderScreen(<ReliveScreen />);
    await fireEvent.press(getByLabelText('Share this game'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/share/[template]',
      params: { template: 'game', payload: expect.any(String) },
    });
    const call = mockPush.mock.calls[0]?.[0] as { params: { payload: string } };
    expect(JSON.parse(call.params.payload)).toMatchObject({
      kind: 'game',
      away: 'Mets',
      home: 'Phillies',
      awayScore: 3,
      homeScore: 6,
      status: 'final',
      result: 'win',
      venue: 'Citizens Bank Park',
    });
  });

  it.each([['Add a photo'], ['Add a photo from your library']])(
    'opens the photo picker from %s',
    async (label) => {
      const { getByLabelText } = await renderScreen(<ReliveScreen />);
      await fireEvent.press(getByLabelText(label));
      expect(mockPicker).toHaveBeenCalledTimes(1);
    },
  );

  // The row's own copy says "Opens in the league's video site", so it has to open one.
  it('opens the league video site from the highlights row', async () => {
    const { getByLabelText } = await renderScreen(<ReliveScreen />);
    await fireEvent.press(getByLabelText("Official highlights, opens in the league's video site"));
    expect(Linking.openURL).toHaveBeenCalledWith('https://www.mlb.com/video');
  });
});
