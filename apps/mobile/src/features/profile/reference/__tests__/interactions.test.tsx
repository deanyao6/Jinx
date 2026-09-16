import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { renderScreen } from '@/test/renderScreen';

import { ProfileScreen } from '../ProfileScreen';

describe('Profile interactions', () => {
  it('opens the Friends panel and closes it again', async () => {
    const { getByText, getByLabelText, queryByText } = await renderScreen(<ProfileScreen />);
    expect(queryByText('Your record when you go together')).toBeNull();

    await fireEvent.press(getByText('Friends'));
    expect(getByText('Your record when you go together')).toBeTruthy();
    expect(getByText('Rivalry with Jordan, Mets fan')).toBeTruthy();

    await fireEvent.press(getByLabelText('Back to profile'));
    expect(queryByText('Your record when you go together')).toBeNull();
  });

  it('switches the Friends segment', async () => {
    const { getByText } = await renderScreen(<ProfileScreen initialPanel="friends" />);
    await fireEvent.press(getByText('Rivals'));
    expect(getByText('Rivals')).toBeTruthy();
  });
});
