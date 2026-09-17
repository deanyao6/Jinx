import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { demoRepository } from '@/features/data/demo';
import type { Repository } from '@/features/data/types';
import { renderScreen } from '@/test/renderScreen';

import { PassportScreen } from '../PassportScreen';

const mockPush = jest.fn();
const mockReplace = jest.fn();
// Same shape as the tab bar test's mock: the screens only need useRouter, and the real
// module drags the whole router runtime into a unit test about eight controls.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
}));

/**
 * The Passport screen's controls, wired per docs/interactions.md. Everything below looked
 * tappable and did nothing: the parity harness drives the screen over a control channel,
 * so it scored full marks with every one of them dead.
 *
 * Two route params are not real ids. The demo fixtures carry no game id — `lastGame` is a
 * display line and a log row has a title and a venue line — so those rows pass the only
 * identifier they have, which is asserted here as exactly that rather than as a plausible
 */
describe('Passport navigation', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  it('opens notifications from the bell', async () => {
    const { getByLabelText } = await renderScreen(<PassportScreen />);
    await fireEvent.press(getByLabelText('Notifications'));
    expect(mockPush).toHaveBeenCalledWith('/you/notifications');
  });

  it('goes to the Profile tab from the person icon, replacing rather than stacking', async () => {
    const { getByLabelText } = await renderScreen(<PassportScreen />);
    await fireEvent.press(getByLabelText('Your profile'));
    expect(mockReplace).toHaveBeenCalledWith('/profile');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens the game from the hero Last Game row', async () => {
    const { getByLabelText } = await renderScreen(<PassportScreen />);
    await fireEvent.press(getByLabelText('Last Game: PHI 4 – 2 NYM'));
    expect(mockPush).toHaveBeenCalledWith('/games/demo-phillies-mets-2025-08-14');
  });

  it('follows the pill filter, so the hero row opens the selected team last game', async () => {
    const { getByLabelText, getByTestId } = await renderScreen(<PassportScreen />);
    await fireEvent.press(getByTestId('pill-phl'));
    await fireEvent.press(getByLabelText('Last Game: PHI 24 – 27 LAR'));
    expect(mockPush).toHaveBeenCalledWith('/games/demo-eagles-commanders-2024-12-22');
  });

  it('opens the stamps screen from the section count link', async () => {
    const { getByLabelText } = await renderScreen(<PassportScreen />);
    await fireEvent.press(getByLabelText('Stadium stamps: View All (8)'));
    expect(mockPush).toHaveBeenCalledWith('/passport/stamps');
  });

  it('opens the stamps screen from a stamp tile', async () => {
    const { getByLabelText } = await renderScreen(<PassportScreen />);
    await fireEvent.press(getByLabelText('Citizens Bank, PHILADELPHIA'));
    expect(mockPush).toHaveBeenCalledWith('/passport/stamps');
  });

  it('opens the superlatives screen from a superlative row', async () => {
    const { getByLabelText } = await renderScreen(<PassportScreen />);
    await fireEvent.press(getByLabelText('Most Seen Player: Bryce Harper'));
    expect(mockPush).toHaveBeenCalledWith('/passport/superlatives');
  });

  // Real rows say where they go (`superlativeHref`); the demo rows above name no real game.
  describe('with real superlatives', () => {
    const repository: Repository = {
      ...demoRepository,
      passport: (pill) => ({
        ...demoRepository.passport(pill),
        superlatives: [
          {
            icon: 'i-user',
            label: 'Seen Bryce Harper play',
            value: '14 times',
            chip: '',
            href: '/passport/player/p1',
          },
          {
            icon: 'i-thermo',
            label: 'Coldest game',
            value: '19°F',
            chip: 'DAL at PHI, Jan 2024',
            href: '/games/g1',
          },
          { icon: 'i-spark', label: 'Longest win streak', value: '5 games', chip: '' },
        ],
      }),
    };

    it('opens the games you saw the player in from the favourite player row', async () => {
      const { getByLabelText } = await renderScreen(<PassportScreen />, { repository });
      await fireEvent.press(getByLabelText('Seen Bryce Harper play: 14 times'));
      expect(mockPush).toHaveBeenCalledWith('/passport/player/p1');
    });

    it('opens the game a number is from', async () => {
      const { getByLabelText } = await renderScreen(<PassportScreen />, { repository });
      await fireEvent.press(getByLabelText('Coldest game: 19°F'));
      expect(mockPush).toHaveBeenCalledWith('/games/g1');
    });

    it('still reaches the full list: from a row about no one game, and from View All', async () => {
      const { getByLabelText } = await renderScreen(<PassportScreen />, { repository });
      await fireEvent.press(getByLabelText('Longest win streak: 5 games'));
      expect(mockPush).toHaveBeenLastCalledWith('/passport/superlatives');
      await fireEvent.press(getByLabelText('Fan superlatives: View All'));
      expect(mockPush).toHaveBeenCalledTimes(2);
      expect(mockPush).toHaveBeenLastCalledWith('/passport/superlatives');
    });
  });

  it('keeps the demo header as the reference draws it, with no View All', async () => {
    const { queryByLabelText } = await renderScreen(<PassportScreen />);
    expect(queryByLabelText('Fan superlatives: View All')).toBeNull();
  });
});

describe('Record game log panel navigation', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  /** The panel only exists over the Passport screen, opened from a record card. */
  async function openLog() {
    const screen = await renderScreen(<PassportScreen />);
    await fireEvent.press(screen.getByTestId('record-card-neutral'));
    mockPush.mockClear();
    return screen;
  }

  // The share icon is deliberately inert until the repository returns the record as
  // numbers rather than display strings; see the comment in GameLogPanel. Asserting it is
  // not a button keeps that decision honest instead of letting a broken route creep back.
  it('does not offer a share button it cannot fulfil', async () => {
    const { queryByLabelText } = await openLog();
    expect(queryByLabelText('Share this record')).toBeNull();
  });

  it('opens the game from a log row', async () => {
    const { getByLabelText } = await openLog();
    await fireEvent.press(getByLabelText('Picked Bears vs Packers, Won, picked at 38%, +0.62'));
    expect(mockPush).toHaveBeenCalledWith('/games/demo-neutral-bears-packers');
  });

  it('opens History from the "+N more" footer', async () => {
    const { getByLabelText } = await openLog();
    await fireEvent.press(getByLabelText('13 more games'));
    expect(mockPush).toHaveBeenCalledWith('/games');
  });
});
