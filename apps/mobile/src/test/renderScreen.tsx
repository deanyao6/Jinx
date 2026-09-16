import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { RepositoryProvider } from '@/features/data/context';
import { demoRepository } from '@/features/data/demo';
import type { Repository, RepositoryStatus } from '@/features/data/types';

/**
 * Renders a ported screen with the context it needs outside its own tree.
 *
 * Every reference screen reads the safe-area insets, because the app draws under the real
 * status bar where the reference draws a fake one. Without a provider they throw rather
 * than defaulting, so this supplies the iPhone 17 Pro's real metrics — the same device the
 * parity harness measures against.
 */
export const IPHONE_17_PRO: Metrics = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 62, left: 0, right: 0, bottom: 34 },
};

/**
 * The repository a test screen reads from, demo fixtures unless one is passed.
 *
 * In the app a screen reads the signed-in user's own data (SPEC.md 8.9), so there is no
 * fixture account to assert against unless a test asks for one. These tests are about what
 * a control does, not whose data it shows, so they state that choice here instead of
 * inheriting it. Pass `emptyRepository` to exercise a screen's empty state.
 */
export function renderScreen(
  ui: React.ReactElement,
  options: { repository?: Repository; status?: RepositoryStatus } = {},
) {
  // Retries and background refetches would outlive the test; a client per render also keeps
  // one test's cache out of the next one.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SafeAreaProvider initialMetrics={IPHONE_17_PRO}>
        <RepositoryProvider
          repository={options.repository ?? demoRepository}
          status={options.status ?? (options.repository ? 'ready' : 'demo')}
        >
          {ui}
        </RepositoryProvider>
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}
