import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { renderScreen } from '@/test/renderScreen';

import { PickASideScreen } from '../PickASideScreen';

describe('Pick a side interactions', () => {
  it('confirms the pick with the vs-expected gain', async () => {
    const { getByText, queryByText } = await renderScreen(<PickASideScreen />);
    expect(queryByText(/You're rooting for/)).toBeNull();

    await fireEvent.press(getByText('Root for NY Mets'));

    // 1 - 0.58 = 0.42, formatted to two decimals as the reference's handler does.
    expect(
      getByText(
        "You're rooting for the Mets. Switch anytime before it locks. " +
          'A win adds +0.42 to your neutral record vs expected.',
      ),
    ).toBeTruthy();
  });

  it('lets you switch sides, and recomputes the gain', async () => {
    const { getByText } = await renderScreen(<PickASideScreen />);
    await fireEvent.press(getByText('Root for NY Mets'));
    await fireEvent.press(getByText('Root for SD Padres'));

    // The Padres were given 42%, so a win is worth more.
    expect(getByText(/rooting for the Padres/)).toBeTruthy();
    expect(getByText(/\+0\.58/)).toBeTruthy();
  });
});
