import { render } from '@testing-library/react-native';
import React from 'react';

import { Card } from '../Card';
import { Text } from '../Text';

describe('Card', () => {
  it('renders its label and children', async () => {
    const { getByText } = await render(
      <Card label="All-time record">
        <Text>31–17</Text>
      </Card>,
    );
    expect(getByText('All-time record')).toBeTruthy();
    expect(getByText('31–17')).toBeTruthy();
  });
});
