import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useRankedGames, useSearchInterpretation } from '../queries';

const mockRpc = jest.fn();
let mockUserId = 'first-user';
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock('@/features/auth/hooks', () => ({ useAuth: () => ({ userId: mockUserId }) }));

function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
beforeEach(() => {
  mockRpc.mockReset();
  mockUserId = 'first-user';
});

it('aborts stale entity requests and ignores their late responses', async () => {
  let finishOld: (value: unknown) => void = () => {};
  let oldSignal: AbortSignal | undefined;
  mockRpc.mockImplementation((_name: string, args: { p_phrases: string[] }) => ({
    abortSignal: (signal: AbortSignal) =>
      args.p_phrases.includes('old')
        ? new Promise((resolve) => {
            oldSignal = signal;
            finishOld = resolve;
          })
        : Promise.resolve({ data: [], error: null }),
  }));
  const { wrapper, client } = harness();
  const hook = await renderHook(
    ({ query }: { query: string }) => useSearchInterpretation(query, {}),
    { initialProps: { query: 'old' }, wrapper },
  );
  await waitFor(() => expect(oldSignal).toBeDefined());
  await hook.rerender({ query: 'new' });
  await waitFor(() => expect(hook.result.current.resolving).toBe(false));
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => finishOld({ data: [{ phrase: 'old' }], error: null }));
  expect(hook.result.current.parsed.query).toBe('new');
  expect(hook.result.current.candidates).toEqual([]);
  client.clear();
});

it('binds pagination to each query and clears the cursor after scope changes', async () => {
  mockRpc.mockImplementation((_name: string, args: { p_cursor?: unknown }) => ({
    abortSignal: () =>
      Promise.resolve({
        data: { rows: [], nextCursor: args.p_cursor ? null : { key: 'first-page' } },
        error: null,
      }),
  }));
  const { wrapper, client } = harness();
  const hook = await renderHook(
    ({ scope }: { scope: 'mine' | 'all' }) =>
      useRankedGames({
        query: '2025',
        filters: {},
        scope,
        sort: 'best',
        personalText: false,
        enabled: true,
      }),
    { initialProps: { scope: 'mine' }, wrapper },
  );
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  await act(async () => {
    await hook.result.current.fetchNextPage();
  });
  expect(mockRpc).toHaveBeenLastCalledWith(
    'search_games_v2',
    expect.objectContaining({ p_cursor: { key: 'first-page' }, p_scope: 'mine' }),
  );
  await hook.rerender({ scope: 'all' });
  await waitFor(() =>
    expect(mockRpc).toHaveBeenLastCalledWith(
      'search_games_v2',
      expect.objectContaining({ p_cursor: undefined, p_scope: 'all' }),
    ),
  );
  client.clear();
});

it('does not reuse another signed-in user’s result cache', async () => {
  mockRpc.mockImplementation(() => ({
    abortSignal: () => Promise.resolve({ data: { rows: [], nextCursor: null }, error: null }),
  }));
  const { wrapper, client } = harness();
  const hook = await renderHook(
    () =>
      useRankedGames({
        query: 'Dad',
        filters: {},
        scope: 'mine',
        sort: 'best',
        personalText: true,
        enabled: true,
      }),
    { wrapper },
  );
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(mockRpc).toHaveBeenCalledTimes(1);
  mockUserId = 'second-user';
  await hook.rerender({});
  await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));
  client.clear();
});
