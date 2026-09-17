import { act, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useAuthStore } from '@/features/auth/store';
import { demoRepository } from '@/features/data/demo';
import { curseLine } from '@/features/eggs/curse';
import { formatTally } from '@/features/eggs/rewind';
import { useEggStore } from '@/features/eggs/store';
import { PassportScreen } from '@/features/passport/reference/PassportScreen';
import { history } from '@/test/eggHistory';
import { renderScreen } from '@/test/renderScreen';

const ME = '11111111-1111-4111-8111-111111111111';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useIsFocused: () => true,
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

// Nothing here talks to a backend, and the real client keeps a refresh timer running.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

jest.mock('@/features/players/queries', () => ({
  useFavoritePlayersSeen: () => ({ data: undefined }),
}));

// The screen is handed its repository below. Without this the signed-in one would also start,
// a dozen real queries against a backend that is not there.
jest.mock('@/features/data/useSupabaseRepository', () => {
  const idle = { repository: {}, status: 'loading' };
  return { useSupabaseRepository: () => idle };
});

/** The attended games the eggs read. The same hook the record game log is built from. */
const mockAttendances = jest.fn();
jest.mock('@/features/attendances/queries', () => ({
  ...jest.requireActual('@/features/attendances/queries'),
  useMyAttendances: () => ({ data: mockAttendances() }),
}));

/** `history()` as the attendances query returns it: newest first, as rows. */
function attended(results: string, start?: number) {
  return history(results, start)
    .map((g) => ({
      status: 'attended',
      verified_via: null,
      rooting_team_id: g.rootingTeamId,
      game: {
        id: g.gameId,
        sport_id: 'mlb',
        status: g.status,
        scheduled_start: g.scheduledStart,
        home_team_id: g.homeTeamId,
        away_team_id: g.awayTeamId,
        home_score: g.homeScore,
        away_score: g.awayScore,
        home: { abbreviation: g.homeAbbreviation },
        away: { abbreviation: g.awayAbbreviation },
      },
    }))
    .reverse();
}

// A real person's repository: the fixtures' content, but not the demo repository itself and
// not in demo status, which is how `useEggsLive` tells them apart.
const real = { repository: { ...demoRepository }, status: 'ready' as const };

beforeEach(() => {
  mockAttendances.mockReturnValue([]);
  useAuthStore.setState({ userId: ME });
  useEggStore.setState({ curseCelebrated: {}, rallyCaps: {}, confettiGames: [] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('demo mode', () => {
  it('draws no egg at all: the Passport is what the parity harness compares', async () => {
    mockAttendances.mockReturnValue(attended('LLLLLW', Date.now() - 6 * 86_400_000));
    const demo = await renderScreen(<PassportScreen />);
    expect(demo.queryByTestId('record-rewind')).toBeNull();
    expect(demo.queryByTestId('curse-shatter')).toBeNull();
    expect(demo.queryByTestId('rally-cap-wordmark')).toBeNull();
    expect(demo.getByText('31 – 17')).toBeTruthy();
    expect(demo.getByText('JINX')).toBeTruthy();
  });
});

describe('record rewind', () => {
  it('rewinds to zero on a long press, replays the games, and snaps back on release', async () => {
    jest.useFakeTimers();
    mockAttendances.mockReturnValue(attended('WLW', Date.UTC(2025, 8, 14, 19, 0)));
    const screen = await renderScreen(<PassportScreen />, real);
    const record = screen.getByTestId('record-rewind');
    expect(screen.getByText('31 – 17')).toBeTruthy();

    await fireEvent(record, 'longPress');
    // Winding back: today's record is gone and the number is on its way down.
    expect(screen.queryByText('31 – 17')).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(12 * 45);
    });
    expect(screen.getByText(formatTally({ w: 0, l: 0, t: 0 }))).toBeTruthy();

    // Then forward, one game at a time, each with its line.
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.getByText(formatTally({ w: 1, l: 0, t: 0 }))).toBeTruthy();
    expect(screen.getByText(/Sep 14, 2025 · NYM at PHI · W/)).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(screen.getByText(formatTally({ w: 1, l: 1, t: 0 }))).toBeTruthy();

    // Lifting the finger ends it at once, on today's record.
    await fireEvent(record, 'pressOut');
    expect(screen.getByText('31 – 17')).toBeTruthy();
    expect(screen.queryByText(/NYM at PHI/)).toBeNull();
  });

  it('ends on the record by itself', async () => {
    jest.useFakeTimers();
    mockAttendances.mockReturnValue(attended('WL'));
    const screen = await renderScreen(<PassportScreen />, real);
    await fireEvent(screen.getByTestId('record-rewind'), 'longPress');
    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    expect(screen.getByText('31 – 17')).toBeTruthy();
  });

  it('does nothing with no history, and leaves the Last Game row alone', async () => {
    const screen = await renderScreen(<PassportScreen />, real);
    await fireEvent(screen.getByTestId('record-rewind'), 'longPress');
    expect(screen.getByText('31 – 17')).toBeTruthy();
    expect(screen.getByLabelText(/Last Game/i)).toBeTruthy();
  });
});

describe('curse breaker', () => {
  it('shatters once for a fresh win that ended five losses, and remembers it', async () => {
    mockAttendances.mockReturnValue(attended('LLLLLW', Date.now() - 6 * 86_400_000));
    const screen = await renderScreen(<PassportScreen />, real);
    await waitFor(() => expect(screen.getByTestId('curse-shatter')).toBeTruthy());
    expect(screen.getByText(curseLine(5))).toBeTruthy();
    expect(useEggStore.getState().curseCelebrated[ME]).toBe('g5');
    await screen.unmount();

    const again = await renderScreen(<PassportScreen />, real);
    await act(async () => {});
    expect(again.queryByTestId('curse-shatter')).toBeNull();
  });

  it('stays quiet after four', async () => {
    mockAttendances.mockReturnValue(attended('LLLLW', Date.now() - 5 * 86_400_000));
    const screen = await renderScreen(<PassportScreen />, real);
    await act(async () => {});
    expect(screen.queryByTestId('curse-shatter')).toBeNull();
    expect(useEggStore.getState().curseCelebrated[ME]).toBeUndefined();
  });
});
