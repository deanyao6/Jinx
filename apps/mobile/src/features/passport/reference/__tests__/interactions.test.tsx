import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { renderScreen } from '@/test/renderScreen';

import { PassportScreen } from '../PassportScreen';

/**
 * The parity harness proves each screen *renders* a given state correctly. It cannot
 * prove that tapping something reaches that state, because it drives the app over a
 * control channel rather than by touching it. These tests cover that half.
 */
describe('Passport interactions', () => {
  it('filters the whole screen when a team pill is selected', async () => {
    const { getByText, queryByText, getByTestId } = await renderScreen(<PassportScreen />);

    // All teams: the lifetime record and the three record cards.
    expect(getByText('LIFETIME RECORD')).toBeTruthy();
    expect(getByText('31 – 17')).toBeTruthy();
    expect(getByText('Neutral')).toBeTruthy();

    await fireEvent.press(getByTestId('pill-phi'));

    // The hero, its label, the badge and the cards all change together.
    expect(getByText('PHILLIES RECORD')).toBeTruthy();
    expect(getByText('17 GAMES ATTENDED')).toBeTruthy();
    expect(getByText('With Dad')).toBeTruthy();
    expect(queryByText('LIFETIME RECORD')).toBeNull();
    // Superlatives are per-team too.
    expect(getByText('Most Seen Phillie')).toBeTruthy();
  });

  it('shows only that team stamps when a pill is selected', async () => {
    const { getByText, queryByText, getByTestId } = await renderScreen(<PassportScreen />);
    expect(getByText('Lincoln Financial')).toBeTruthy();

    await fireEvent.press(getByTestId('pill-phi'));

    // Lincoln Financial and MetLife are Eagles stamps, so they drop out of this view.
    expect(queryByText('Lincoln Financial')).toBeNull();
    expect(queryByText('MetLife Stadium')).toBeNull();
    // The Phillies stamps stay. ("Citizens Bank" is not asserted directly: it is also the
    // chip on the Loudest Stadium superlative, so the text appears twice.)
    expect(getByText('Citi Field')).toBeTruthy();
    expect(getByText('Dodger Stadium')).toBeTruthy();
    expect(getByText('View All (4)')).toBeTruthy();
  });

  it('opens a record card game log, titled from the card', async () => {
    const { getByText, queryByText, getByTestId } = await renderScreen(<PassportScreen />);
    expect(queryByText('Phillies record at games')).toBeNull();

    await fireEvent.press(getByTestId('pill-phi'));
    await fireEvent.press(getByTestId('record-card-dad'));

    // The panel header takes the card's own label and record, not the log's.
    expect(getByText('With Dad')).toBeTruthy();
    expect(getByText('Phillies record at games')).toBeTruthy();
    expect(getByText('7 – 1')).toBeTruthy();
    expect(getByText('10 more games')).toBeTruthy();
  });

  it('titles the neutral card log "As a neutral", not "Neutral"', async () => {
    const { getByText, getByTestId } = await renderScreen(<PassportScreen />);
    await fireEvent.press(getByTestId('record-card-neutral'));
    expect(getByText('As a neutral')).toBeTruthy();
    expect(getByText('Record as a neutral')).toBeTruthy();
  });

  it('closes the game log again', async () => {
    const { getByText, getByLabelText, queryByText, getByTestId } = await renderScreen(
      <PassportScreen />,
    );
    await fireEvent.press(getByTestId('record-card-neutral'));
    expect(getByText('Record as a neutral')).toBeTruthy();

    await fireEvent.press(getByLabelText('Back to passport'));
    expect(queryByText('Record as a neutral')).toBeNull();
  });
});
