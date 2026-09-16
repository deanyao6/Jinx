import { act, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { RELIVE_STEPS } from '@/features/demo/fixtures';
import { renderScreen } from '@/test/renderScreen';

import { ReliveScreen } from '../ReliveScreen';

describe('Relive story player', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('advances a step immediately on play, then every 1.7s', async () => {
    const { getByText, getByLabelText } = await renderScreen(<ReliveScreen />);
    // The period label appears twice, in the scorebug and on the story card, so these
    // assert the story text instead, which is unique to each step.
    expect(getByText('Phillies were 55% to win before first pitch.')).toBeTruthy();

    await fireEvent.press(getByLabelText('Play the game story'));
    // The reference's handler advances once straight away rather than waiting.
    expect(getByText('Mets score first on a sacrifice fly.')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1700);
    });
    expect(
      getByText('Two-run double puts the Phillies ahead. First high five with Dad.'),
    ).toBeTruthy();
  });

  it('pauses where it is', async () => {
    const { getByText, getByLabelText } = await renderScreen(<ReliveScreen />);
    await fireEvent.press(getByLabelText('Play the game story'));
    await fireEvent.press(getByLabelText('Pause the game story'));

    await act(async () => {
      jest.advanceTimersByTime(1700 * 3);
    });
    expect(getByText('Mets score first on a sacrifice fly.')).toBeTruthy();
  });

  it('stops at the final step and restarts from the top', async () => {
    const { getByText, getByLabelText } = await renderScreen(<ReliveScreen />);
    await fireEvent.press(getByLabelText('Play the game story'));

    await act(async () => {
      jest.advanceTimersByTime(1700 * RELIVE_STEPS.length * 2);
    });
    expect(getByText('Phillies win. Your record with Dad goes to 7–1.')).toBeTruthy();
    // It stopped rather than running off the end, so the icon is back to play.
    expect(getByLabelText('Play the game story')).toBeTruthy();

    await fireEvent.press(getByLabelText('Play the game story'));
    expect(getByText('Phillies were 55% to win before first pitch.')).toBeTruthy();
  });
});
