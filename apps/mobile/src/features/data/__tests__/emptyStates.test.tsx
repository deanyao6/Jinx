import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { PickASideScreen } from '@/features/checkin/reference/PickASideScreen';
import { GamesScreen } from '@/features/games/reference/GamesScreen';
import { StadiumGuideScreen } from '@/features/guide/reference/StadiumGuideScreen';
import { PassportScreen } from '@/features/passport/reference/PassportScreen';
import { GameDayScreen } from '@/features/plan/reference/GameDayScreen';
import { ProfileScreen } from '@/features/profile/reference/ProfileScreen';
import { ReliveScreen } from '@/features/relive/reference/ReliveScreen';
import { renderScreen } from '@/test/renderScreen';

import { emptyRepository } from '../empty';

/**
 * What every screen shows a user who has nothing there yet.
 *
 * These are the screens' side of the same rule the repository enforces: nothing may fall
 * back to the demo account to fill space. A user with one logged game has to be able to
 * tell a bug from an empty passport, and the only way that works is if the empty state is
 * real, visible, and says nothing about anyone else's games.
 */
const empty = { repository: emptyRepository, status: 'ready' as const };

/** Text from the reference's fixture account. None of it may appear in an empty screen. */
const FIXTURE_LEAKS = [
  '31 – 17',
  '48 GAMES ATTENDED',
  'Citizens Bank Park',
  'Dad',
  'Maya Chen',
  'Dean Yao',
  '@deanyao',
  'Cheesesteak',
  'Root for NY Mets',
];

function assertNoFixtures(queryByText: (t: string) => unknown) {
  for (const text of FIXTURE_LEAKS) expect(queryByText(text)).toBeNull();
}

describe('empty states', () => {
  it('Passport says what is missing instead of borrowing a record', async () => {
    const { getByText, queryByText } = await renderScreen(<PassportScreen />, empty);
    getByText('LIFETIME RECORD');
    getByText('0 GAMES ATTENDED');
    getByText('No games logged yet');
    getByText('No records yet. Log a game and your lifetime record starts here.');
    getByText('No stamps yet. Each new stadium you log earns one.');
    getByText(
      'No superlatives yet. The coldest game, the longest one and the rest arrive once you have games to compare.',
    );
    assertNoFixtures(queryByText);
  });

  it('Passport says it is loading rather than that you have nothing', async () => {
    const { getByText, queryByText } = await renderScreen(<PassportScreen />, {
      repository: emptyRepository,
      status: 'loading',
    });
    getByText('Loading your records…');
    getByText('Loading your stamps…');
    expect(
      queryByText('No records yet. Log a game and your lifetime record starts here.'),
    ).toBeNull();
  });

  it('Games shows an empty history, not someone else games', async () => {
    const { getByText, queryByText } = await renderScreen(<GamesScreen />, empty);
    getByText('No games yet. Add one with the + button.');
    assertNoFixtures(queryByText);
  });

  it('Relive says there is nothing to relive, and keeps its way out', async () => {
    const { getByText, getByLabelText, queryByText } = await renderScreen(<ReliveScreen />, empty);
    getByText(
      'Nothing to relive yet. A game gets a story once its play-by-play has been ingested for a game you attended.',
    );
    // The back button is the one control that must survive an empty screen.
    getByLabelText('Back');
    assertNoFixtures(queryByText);
  });

  it('Pick a side says there is no game rather than offering a fixture pledge', async () => {
    const { getByText, queryByText } = await renderScreen(<PickASideScreen />, empty);
    getByText('Pick a side');
    getByText(
      'No game to pick a side in. Check in at a game where you follow neither team and the pledge opens here.',
    );
    assertNoFixtures(queryByText);
  });

  it('Game day says the planner is not built yet', async () => {
    const { getByText, queryByText } = await renderScreen(<GameDayScreen />, empty);
    getByText('Game day');
    getByText(
      "No game-day plan yet. The planner arrives after v1; when it does, a game you are going to shows its ticket, your friends and the day's timeline here.",
    );
    assertNoFixtures(queryByText);
  });

  it('Stadium guide says there is no guide, and keeps its way out', async () => {
    const { getByText, getByLabelText, queryByText } = await renderScreen(
      <StadiumGuideScreen />,
      empty,
    );
    getByText('No stadium guide yet. Ranked food, bathrooms and seats arrive after v1.');
    getByLabelText('Back');
    assertNoFixtures(queryByText);
  });

  it('Profile says it could not load rather than drawing a nameless one', async () => {
    const { getByText, getByLabelText, queryByText } = await renderScreen(<ProfileScreen />, empty);
    getByText(
      'Your profile could not be loaded. Sign out and back in from Settings if it stays this way.',
    );
    // Settings has to stay reachable: signing out lives there.
    getByLabelText('Settings');
    assertNoFixtures(queryByText);
  });

  it('Friends says each tab is empty rather than listing the fixture friends', async () => {
    const { getByText, queryByText } = await renderScreen(
      <ProfileScreen initialPanel="friends" />,
      empty,
    );
    getByText('No games with anyone yet.');
    await fireEvent.press(getByText('Following'));
    getByText('You are not following anyone yet.');
    await fireEvent.press(getByText('Rivals'));
    getByText('No rivals yet.');
    assertNoFixtures(queryByText);
  });
});
