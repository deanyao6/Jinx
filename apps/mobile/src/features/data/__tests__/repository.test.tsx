import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { RepositoryProvider, useRepository } from '../context';
import { demoRepository } from '../demo';
import type { Repository } from '../types';

/**
 * SPEC.md 8.9 requires every screen to read through a repository so demo fixtures and
 * Supabase are interchangeable without touching UI code. These pin the two properties
 * that makes true: the default is demo, and a provided implementation is what screens see.
 */
function Probe() {
  const repo = useRepository();
  return <Text>{repo.passport('all').record}</Text>;
}

describe('repository', () => {
  it('defaults to the demo implementation, so demo mode needs no backend', async () => {
    const { getByText } = await render(<Probe />);
    getByText('31 – 17');
  });

  it('hands screens whatever implementation is provided', async () => {
    const stub: Repository = {
      ...demoRepository,
      passport: () => ({ ...demoRepository.passport('all'), record: '99 – 0' }),
    };
    const { getByText } = await render(
      <RepositoryProvider repository={stub}>
        <Probe />
      </RepositoryProvider>,
    );
    getByText('99 – 0');
  });

  it('returns a falsy game log rather than throwing for an unknown record', () => {
    expect(demoRepository.gameLog('not-a-record')).toBeNull();
    expect(demoRepository.gameLog('phi')).not.toBeNull();
  });

  it('falls back rather than returning nothing for an unknown pill or guide tab', () => {
    // A screen must always have something to render, so these are total.
    expect(demoRepository.passport('not-a-pill').record).toBe('31 – 17');
    expect(demoRepository.guideRows('not-a-tab')).toEqual(demoRepository.guideRows('food'));
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
});
