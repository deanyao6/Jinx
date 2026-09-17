import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthStore } from '@/features/auth/store';
import { LogSheet } from '../LogSheet';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }),
}));

type Row = Record<string, unknown>;
const mockFixtures: Record<string, Row[]> = {};
const mockInserted: Record<string, Row[]> = {};

/** Minimal chainable stand-in for supabase-js: every filter returns the mockBuilder, awaiting resolves. */
function mockBuilder(table: string) {
  let single = false;
  let rows: Row[] = mockFixtures[table] ?? [];
  const api: Record<string, unknown> = {};
  const chain = () => api;
  for (const m of [
    'select',
    'eq',
    'neq',
    'order',
    'limit',
    'gte',
    'lte',
    'or',
    'not',
    'delete',
    'upsert',
  ]) {
    api[m] = chain;
  }
  api['insert'] = (payload: Row | Row[]) => {
    const list = Array.isArray(payload) ? payload : [payload];
    mockInserted[table] = [...(mockInserted[table] ?? []), ...list];
    rows = list.map((r, i) => ({ id: `${table}-${i + 1}`, ...r }));
    return api;
  };
  api['single'] = () => {
    single = true;
    return api;
  };
  api['maybeSingle'] = () => {
    single = true;
    return api;
  };
  api['then'] = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve({ data: single ? (rows[0] ?? null) : rows, error: null }).then(resolve, reject);
  return api;
}

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockBuilder(table),
    rpc: () => mockBuilder('rpc'),
  },
}));

const game = {
  id: 'g1',
  sport_id: 'mlb',
  season: 2019,
  game_type: 'regular',
  scheduled_start: '2019-08-10T23:05:00Z',
  status: 'final',
  home_team_id: 't-phi',
  away_team_id: 't-nym',
  home_score: 5,
  away_score: 2,
  winner_team_id: 't-phi',
  is_tie: false,
  doubleheader_number: 2,
  rescheduled_from_game_id: null,
  rescheduled_to_game_id: null,
  venue_id: 'v1',
  home: {
    id: 't-phi',
    name: 'Philadelphia Phillies',
    abbreviation: 'PHI',
    sport_id: 'mlb',
    franchise_id: 'mlb-143',
  },
  away: {
    id: 't-nym',
    name: 'New York Mets',
    abbreviation: 'NYM',
    sport_id: 'mlb',
    franchise_id: 'mlb-121',
  },
  venue: { id: 'v1', name: 'Citizens Bank Park', city: 'Philadelphia', state: 'PA' },
};

function renderSheet() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <QueryClientProvider client={client}>
        <LogSheet gameId="g1" />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('LogSheet', () => {
  beforeEach(() => {
    useAuthStore.getState().setSession({ user: { id: 'u1' } } as never);
    for (const k of Object.keys(mockFixtures)) delete mockFixtures[k];
    for (const k of Object.keys(mockInserted)) delete mockInserted[k];
    mockFixtures['games'] = [game];
    mockFixtures['attendances'] = [];
    mockFixtures['people'] = [{ id: 'p1', display_name: 'Dad', linked_user_id: null }];
    mockFixtures['user_teams'] = [{ team_id: 't-phi', team: game.home }];
    mockReplace.mockClear();
  });

  it('renders the matchup, doubleheader label, companions, and the favorite-side note', async () => {
    const screen = await renderSheet();
    // The matchup is a scoreboard now: each side is one labelled block with its own score.
    await waitFor(() => expect(screen.getByLabelText('New York Mets, away, 2')).toBeTruthy());
    expect(screen.getByLabelText('Philadelphia Phillies, home, 5')).toBeTruthy();
    expect(screen.getByText(/Doubleheader, game 2/)).toBeTruthy();
    expect(screen.getByText(/^Final · /)).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Dad')).toBeTruthy());
    await waitFor(() =>
      expect(screen.getByText('Counts for your Philadelphia Phillies record.')).toBeTruthy(),
    );
    expect(screen.queryByText(/Who are you rooting for/)).toBeNull();
  });

  it('saves a manual attendance with seat, companions, and rooting side', async () => {
    const screen = await renderSheet();
    await waitFor(() => expect(screen.getByText('Dad')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('Log this game')).toBeTruthy());

    await fireEvent.press(screen.getByLabelText('Dad'));
    await fireEvent.changeText(screen.getByLabelText('Section'), '121');
    await fireEvent.changeText(screen.getByLabelText('Price'), '45');
    await fireEvent.changeText(screen.getByLabelText('Note'), 'Walk-off!');
    await fireEvent.press(screen.getByText('Log this game'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/games/g1'));
    expect(mockInserted['attendances']?.[0]).toMatchObject({
      user_id: 'u1',
      game_id: 'g1',
      source: 'manual',
      status: 'attended',
      rooting_team_id: 't-phi',
      rooting_basis: 'favorite',
      note: 'Walk-off!',
    });
    expect(mockInserted['attendance_seats']?.[0]).toMatchObject({
      section: '121',
      price_cents: 4500,
    });
    expect(mockInserted['attendance_companions']).toEqual([
      { attendance_id: 'attendances-1', person_id: 'p1' },
    ]);
  });

  it('shows the side picker when both teams are favorites and the postponed banner', async () => {
    mockFixtures['user_teams'] = [
      { team_id: 't-phi', team: game.home },
      { team_id: 't-nym', team: game.away },
    ];
    mockFixtures['games'] = [{ ...game, status: 'postponed', rescheduled_to_game_id: 'g2' }];
    const screen = await renderSheet();
    await waitFor(() => expect(screen.getByText(/Who are you rooting for/)).toBeTruthy());
    expect(screen.getByText('This game was postponed. Log the makeup game instead?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Go to the makeup game'));
    expect(mockReplace).toHaveBeenCalledWith('/games/log/g2');
  });
});
