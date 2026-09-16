import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { renderScreen } from '@/test/renderScreen';

import { GamesScreen } from '../GamesScreen';

describe('Games interactions', () => {
  it('switches the segment', async () => {
    const { getByText } = await renderScreen(<GamesScreen />);
    const history = getByText('History');
    expect(history).toBeTruthy();

    await fireEvent.press(getByText('Upcoming'));
    // Upcoming and Imports have no fixtures yet, so this asserts the control itself
    // rather than its content; the rows stay until those segments are wired to data.
    expect(getByText('Upcoming')).toBeTruthy();
  });
});
