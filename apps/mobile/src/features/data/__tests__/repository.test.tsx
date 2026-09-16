import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { RepositoryProvider, useRepository, useRepositoryStatus } from '../context';
import { demoRepository } from '../demo';
import { emptyRepository } from '../empty';
import type { Repository } from '../types';

/**
 * SPEC.md 8.9 requires every screen to read through a repository so demo fixtures and
 * Supabase are interchangeable without touching UI code. These pin the properties that
 * makes true, and the one that changed: with no provider a screen gets the signed-in
 * user's own data, never the fixture account.
 */
function Probe() {
  const repo = useRepository();
  return (
    <>
      <Text>{repo.passport('all').record}</Text>
      <Text testID="status">{useRepositoryStatus()}</Text>
    </>
  );
}

function withClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('repository', () => {
  it('defaults to the signed-in user data, not the demo fixtures', async () => {
    // Signed out in a test, so the user's data is empty — but it is *their* empty, and it
    // is never the reference's 31–17.
    const { getByText, queryByText } = await withClient(<Probe />);
    expect(queryByText('31 – 17')).toBeNull();
    getByText('0 – 0');
  });

  it('hands screens whatever implementation is provided', async () => {
    const stub: Repository = {
      ...demoRepository,
      passport: () => ({ ...demoRepository.passport('all'), record: '99 – 0' }),
    };
    const { getByText } = await withClient(
      <RepositoryProvider repository={stub}>
        <Probe />
      </RepositoryProvider>,
    );
    getByText('99 – 0');
  });

  it('reports a provided repository as settled', async () => {
    const { getByTestId } = await withClient(
      <RepositoryProvider repository={emptyRepository}>
        <Probe />
      </RepositoryProvider>,
    );
    expect(getByTestId('status').props.children).toBe('ready');
  });

  it('returns a falsy game log rather than throwing for an unknown record', () => {
    expect(demoRepository.gameLog('not-a-record')).toBeNull();
    expect(demoRepository.gameLog('phi')).not.toBeNull();
    // The empty repository has no logs at all, and says so the same way.
    expect(emptyRepository.gameLog('phi')).toBeNull();
  });

  it('falls back rather than returning nothing for an unknown pill or guide tab', () => {
    // A screen must always have something to render, so these are total.
    expect(demoRepository.passport('not-a-pill').record).toBe('31 – 17');
    expect(demoRepository.guideRows('not-a-tab')).toEqual(demoRepository.guideRows('food'));
    expect(emptyRepository.passport('not-a-pill').record).toBe('0 – 0');
    expect(emptyRepository.guideRows('not-a-tab')).toEqual([]);
  });

  it('exposes Relive series and steps as data, not constants', () => {
    // These are per-game, so they come through the repository rather than being imported.
    expect(demoRepository.reliveSteps().length).toBeGreaterThan(1);
    expect(demoRepository.reliveWinProb().length).toBeGreaterThan(1);
    // Every step must point at a real point on the series.
    for (const step of demoRepository.reliveSteps()) {
      expect(demoRepository.reliveWinProb()[step.wp]).toBeDefined();
    }
  });

  it('is empty, not fabricated, wherever the user has nothing', () => {
    // Nothing in the empty repository may carry content from the reference's account.
    expect(emptyRepository.games()).toEqual([]);
    expect(emptyRepository.stamps('all')).toEqual([]);
    expect(emptyRepository.friends().people).toEqual([]);
    expect(emptyRepository.profile().handle).toBe('');
    expect(emptyRepository.passport('all').badge).toBe('0 GAMES ATTENDED');
    expect(emptyRepository.passport('all').lastGame).toBe('No games logged yet');
  });
});
