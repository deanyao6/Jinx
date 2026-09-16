import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { useRepository, useRepositoryStatus } from '../context';

/**
 * Demo mode (SPEC.md 8.9): the build flag, and only the build flag, serves the fixture
 * account. The flag is read once at module load, so it is mocked here rather than set on
 * `process.env` mid-test. Jest hoists this above the imports, which is why it can sit
 * below them and still take effect.
 */
jest.mock('@/lib/env', () => {
  const actual = jest.requireActual('@/lib/env');
  return { ...actual, env: { ...actual.env, demo: true } };
});

function Probe() {
  const repo = useRepository();
  return (
    <>
      <Text>{repo.passport('all').record}</Text>
      <Text>{repo.profile().handle}</Text>
      <Text testID="status">{useRepositoryStatus()}</Text>
    </>
  );
}

describe('demo mode', () => {
  it('serves the reference fixture account when the flag is on', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const { getByText, getByTestId } = await render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    // The parity harness compares these against the reference's own sample data.
    getByText('31 – 17');
    getByText('@deanyao');
    expect(getByTestId('status').props.children).toBe('demo');
  });
});
