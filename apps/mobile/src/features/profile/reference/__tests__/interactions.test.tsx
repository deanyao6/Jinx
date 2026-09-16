import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { renderScreen } from '@/test/renderScreen';

import { ProfileScreen } from '../ProfileScreen';

const mockPush = jest.fn();
const mockReplace = jest.fn();
// Minimal: these screens only need useRouter. Pulling in the real module drags the whole
// router runtime into a unit test for a handful of buttons.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
}));

/**
 * The routes below are asserted as literals rather than read back from the fixture,
 * because a test that derives its expectation from the same data as the code under test
 * only proves they agree. The labels are the fixture's ("2026 goals", "48 Games"), so a
 * fixture change that renames a row shows up here as a failure rather than silently.
 */
describe('Profile interactions', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  it('opens the Friends panel and closes it again', async () => {
    const { getByText, getByLabelText, queryByText } = await renderScreen(<ProfileScreen />);
    expect(queryByText('Your record when you go together')).toBeNull();

    await fireEvent.press(getByText('Friends'));
    expect(getByText('Your record when you go together')).toBeTruthy();
    expect(getByText('Rivalry with Jordan, Mets fan')).toBeTruthy();

    await fireEvent.press(getByLabelText('Back to profile'));
    expect(queryByText('Your record when you go together')).toBeNull();
  });

  it.each([
    ['Settings', '/settings'],
    ['Edit profile', '/you/edit-profile'],
    ['14 Stadiums', '/passport/stamps'],
    // Follower and following lists do not exist yet; both stats land on friend search.
    ['132 Followers', '/friends/find'],
    ['98 Following', '/friends/find'],
    // These three were Pressable with onPress={undefined}: they took the press and ate it.
    ['2026 goals', '/passport/goals'],
    ['Map', '/passport/map'],
    ['2025 Wrapped', '/wrapped/mlb/2025'],
  ])('%s opens %s', async (label, route) => {
    const { getByLabelText } = await renderScreen(<ProfileScreen />);
    await fireEvent.press(getByLabelText(label));
    expect(mockPush).toHaveBeenCalledWith(route);
  });

  it('sends the Games stat to the Games tab, replacing rather than pushing', async () => {
    const { getByLabelText } = await renderScreen(<ProfileScreen />);
    await fireEvent.press(getByLabelText('48 Games'));
    expect(mockReplace).toHaveBeenCalledWith('/games');
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('Friends panel interactions', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  it('opens friend search', async () => {
    const { getByLabelText } = await renderScreen(<ProfileScreen initialPanel="friends" />);
    await fireEvent.press(getByLabelText('Find friends'));
    expect(mockPush).toHaveBeenCalledWith('/friends/find');
  });

  it.each([
    ['Dad, Phillies, 11 games together', '/friends/person/dad'],
    ['Maya Chen, Phillies, 6 games together', '/friends/person/maya'],
    // The rivalry and overlap cards carry no id, so both resolve the person they name.
    ['Rivalry with Jordan, Mets fan', '/friends/person/jordan'],
    ['Before you connected: Maya Chen', '/friends/person/maya'],
  ])('%s opens %s', async (label, route) => {
    const { getByLabelText } = await renderScreen(<ProfileScreen initialPanel="friends" />);
    await fireEvent.press(getByLabelText(label));
    expect(mockPush).toHaveBeenCalledWith(route);
  });

  /**
   * The tabs used to set state and change nothing, so all three showed the same four
   * people. The fixture has companion records and a rivalry and no follow data, so what a
   * tab can honestly show is: everyone, the rival, and nobody.
   */
  describe('tabs filter the list', () => {
    it('shows every companion on With', async () => {
      const { getByText, queryByText } = await renderScreen(
        <ProfileScreen initialPanel="friends" />,
      );
      expect(getByText('Dad')).toBeTruthy();
      expect(getByText('Jordan Ellis')).toBeTruthy();
      expect(queryByText('You are not following anyone yet.')).toBeNull();
    });

    it('shows only the rival on Rivals', async () => {
      const { getByText, queryByText } = await renderScreen(
        <ProfileScreen initialPanel="friends" />,
      );
      await fireEvent.press(getByText('Rivals'));
      expect(getByText('Jordan Ellis')).toBeTruthy();
      expect(queryByText('Dad')).toBeNull();
      expect(queryByText('Maya Chen')).toBeNull();
      // The head-to-head card is about the rival, so it belongs on this tab.
      expect(getByText('Rivalry with Jordan, Mets fan')).toBeTruthy();
      // The overlap card is about a companion, so it does not.
      expect(queryByText('Before you connected')).toBeNull();
    });

    it('shows an empty state on Following rather than the same list again', async () => {
      const { getByText, queryByText } = await renderScreen(
        <ProfileScreen initialPanel="friends" />,
      );
      await fireEvent.press(getByText('Following'));
      expect(getByText('You are not following anyone yet.')).toBeTruthy();
      expect(queryByText('Dad')).toBeNull();
      expect(queryByText('Jordan Ellis')).toBeNull();
    });
  });
});
