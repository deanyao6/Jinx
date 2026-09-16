import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { renderScreen } from '@/test/renderScreen';

import { StadiumGuideScreen } from '../StadiumGuideScreen';

describe('Stadium guide interactions', () => {
  it('switches the ranked list between segments', async () => {
    const { getByText, queryByText } = await renderScreen(<StadiumGuideScreen />);
    expect(getByText('Cheesesteak')).toBeTruthy();

    await fireEvent.press(getByText('Bathrooms'));
    expect(queryByText('Cheesesteak')).toBeNull();
    expect(getByText('Near Section 132')).toBeTruthy();

    await fireEvent.press(getByText('Seats'));
    expect(queryByText('Near Section 132')).toBeNull();
    expect(getByText('Section 104')).toBeTruthy();
  });

  it('colours the score circle by its threshold', async () => {
    // 9.2 and 8.7 are green, 7.1 amber, 5.8 red, per circCls() in the reference.
    const { getByText } = await renderScreen(<StadiumGuideScreen />);
    expect(getByText('9.2')).toBeTruthy();
    expect(getByText('7.1')).toBeTruthy();
    expect(getByText('5.8')).toBeTruthy();
  });
});
