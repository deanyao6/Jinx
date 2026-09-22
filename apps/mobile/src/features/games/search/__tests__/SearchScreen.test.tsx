import {
  parseSearch as mockParseSearch,
  resolveSearch as mockResolveSearch,
  type SearchCandidate,
} from '@jinx/core';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SearchScreen } from '../SearchScreen';
import type { SearchRow } from '../queries';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../ui/useDebounced', () => ({ useDebounced: (value: string) => value }));
const mockRanked = jest.fn();
const mockMore = jest.fn();
const mockRetry = jest.fn();
let mockRows: SearchRow[] = [];
let mockError = false;
let mockHasNext = false;
let mockSuggestionError = false;
const mockCandidates: SearchCandidate[] = [
  {
    phrase: 'giants',
    id: 'sf',
    kind: 'team',
    name: 'San Francisco Giants',
    label: 'San Francisco Giants · MLB',
    alias: 'Giants',
    tier: 0,
    quality: 1000,
  },
  {
    phrase: 'giants',
    id: 'ny',
    kind: 'team',
    name: 'New York Giants',
    label: 'New York Giants · NFL',
    alias: 'Giants',
    tier: 0,
    quality: 1000,
  },
  {
    phrase: 'philies',
    id: 'phi',
    kind: 'team',
    name: 'Philadelphia Phillies',
    label: 'Philadelphia Phillies · MLB',
    alias: 'Phillies',
    tier: 2,
    quality: 700,
  },
];
jest.mock('../queries', () => ({
  useSearchInterpretation: (query: string, filters: Record<string, string>) => {
    const parsed = mockParseSearch(query, filters);
    return {
      parsed,
      candidates: mockCandidates.filter((c) => parsed.phrases.includes(c.phrase)),
      plans: mockResolveSearch(parsed, mockCandidates),
      resolving: false,
      isError: mockSuggestionError,
      refetch: mockRetry,
    };
  },
  useRankedGames: (input: unknown) => {
    mockRanked(input);
    return {
      data: { pages: [{ rows: mockRows }] },
      isPending: false,
      isError: mockError,
      isFetching: false,
      hasNextPage: mockHasNext,
      isFetchingNextPage: false,
      fetchNextPage: mockMore,
      refetch: mockRetry,
    };
  },
}));
const row = (id: string, logged: boolean): SearchRow => ({
  id,
  logged,
  sport_id: 'mls',
  season: 2022,
  game_type: 'postseason',
  scheduled_start: '2022-11-05T20:00:00Z',
  local_date: '2022-11-05',
  status: 'final',
  home_team_id: 'lafc',
  home_team_name: 'LAFC',
  home_abbr: 'LAFC',
  away_team_id: 'union',
  away_team_name: 'Philadelphia Union',
  away_abbr: 'PHI',
  home_score: 3,
  away_score: 3,
  is_tie: false,
  doubleheader_number: null,
  venue_id: null,
  venue_name: 'BMO Stadium',
  venue_city: 'Los Angeles',
  decision_method: 'shootout',
  home_shootout_score: 3,
  away_shootout_score: 0,
});
function screen(scope: 'mine' | 'all' = 'all', query = '') {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 402, height: 874 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <SearchScreen initialScope={scope} initialQuery={query} />
    </SafeAreaProvider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  mockRows = [];
  mockError = false;
  mockHasNext = false;
  mockSuggestionError = false;
});
it('preserves text when moving from My games to All games', async () => {
  const ui = await screen('mine', '2025');
  await fireEvent.press(ui.getByText('All games'));
  expect(ui.getByLabelText('Search games').props.value).toBe('2025');
  expect(mockRanked).toHaveBeenLastCalledWith(
    expect.objectContaining({ scope: 'all', query: '2025', enabled: true }),
  );
});
it('requires a choice for ambiguous teams', async () => {
  const ui = await screen('all', 'Giants');
  expect(ui.getByText('Which did you mean?')).toBeTruthy();
  expect(mockRanked).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
  await fireEvent.press(ui.getByText('San Francisco Giants · MLB'));
  expect(mockRanked).toHaveBeenLastCalledWith(
    expect.objectContaining({ enabled: true, plan: expect.objectContaining({ teamIds: ['sf'] }) }),
  );
});
it('discloses fuzzy corrections and lets the user remove the interpreted team', async () => {
  const ui = await screen('all', 'philies 2025');
  expect(ui.getByText('Matched Philadelphia Phillies from “philies”.')).toBeTruthy();
  await fireEvent.press(ui.getByText('Philadelphia Phillies ×'));
  expect(mockRanked).toHaveBeenLastCalledWith(
    expect.objectContaining({ filters: { from: '2025-01-01', to: '2025-12-31' } }),
  );
});
it('shows recognized dates as removable filters', async () => {
  const ui = await screen('all', '2025');
  await fireEvent.press(ui.getByText('2025-01-01 to 2025-12-31 ×'));
  expect(ui.getByLabelText('Search games').props.value).toBe('');
});
it('keeps unrecognized words from becoming a broad catalog query', async () => {
  const ui = await screen('all', 'birthday');
  expect(ui.getByText(/Some words could not be matched/)).toBeTruthy();
  expect(mockRanked).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
});
it('preserves owner-only companion search', async () => {
  await screen('mine', 'Dad');
  expect(mockRanked).toHaveBeenLastCalledWith(
    expect.objectContaining({ enabled: true, personalText: true, scope: 'mine' }),
  );
});
it('shows errors separately from empty results and supports retry', async () => {
  mockError = true;
  const ui = await screen('all', '2025');
  expect(ui.queryByText(/No games found/)).toBeNull();
  await fireEvent.press(ui.getByText('Retry search'));
  expect(mockRetry).toHaveBeenCalled();
});
it('does not run results when suggestion lookup fails', async () => {
  mockSuggestionError = true;
  const ui = await screen('all', 'philies');
  await fireEvent.press(ui.getByText('Retry suggestions'));
  expect(mockRanked).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
});
it('paginates explicitly without presenting a loaded count as the total', async () => {
  mockRows = [row('one', true)];
  mockHasNext = true;
  const ui = await screen('all', '2022');
  expect(ui.getByText('1 results loaded')).toBeTruthy();
  await fireEvent.press(ui.getByText('Load more'));
  expect(mockMore).toHaveBeenCalled();
});
it.each([true, false])(
  'routes logged=%s results correctly and preserves penalty detail',
  async (logged) => {
    mockRows = [row('cup', logged)];
    const ui = await screen('all', '2022');
    expect(ui.getByText('Penalties: PHI 0–3 LAFC')).toBeTruthy();
    await fireEvent.press(ui.getByText('Philadelphia Union at LAFC'));
    expect(mockPush).toHaveBeenCalledWith(logged ? '/games/cup' : '/games/log/cup');
  },
);
it('validates impossible dates before a result request', async () => {
  const ui = await screen('all', '2025-02-29');
  expect(ui.getByText('That date does not exist.')).toBeTruthy();
  expect(mockRanked).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
});
