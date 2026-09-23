import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { useAuthStore } from '@/features/auth/store';
import { RallyCapWordmark } from '@/features/eggs/RallyCap';
import { RallyCapWorked } from '@/features/eggs/RallyCapWorked';
import { resetAccelerometerCache } from '@/features/eggs/shake';
import { StretchConfetti } from '@/features/eggs/StretchConfetti';
import { useEggPreview, useEggStore } from '@/features/eggs/store';

const ME = '11111111-1111-4111-8111-111111111111';
const GAME = 'game-1';

let mockFocused = true;
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

// expo-sensors, as a binary that has it: one listener at a time, and a way to shake it.
const mockRemove = jest.fn();
let mockListener: ((m: { x: number; y: number; z: number }) => void) | null = null;
jest.mock('expo', () => ({ requireOptionalNativeModule: () => ({}) }));
jest.mock('expo-sensors', () => ({
  Accelerometer: {
    setUpdateInterval: jest.fn(),
    addListener: (listener: (m: { x: number; y: number; z: number }) => void) => {
      mockListener = listener;
      return {
        remove: () => {
          mockListener = null;
          mockRemove();
        },
      };
    },
  },
}));

const mockAttendances = jest.fn();
jest.mock('@/features/attendances/queries', () => ({
  attendanceKeys: { all: ['attendances'] },
  useMyAttendances: () => ({ data: mockAttendances() }),
}));

const mockLive = jest.fn();
const mockLiveEnabled = jest.fn();
jest.mock('@/features/checkin/queries', () => ({
  useLiveState: (gameId: string | undefined, _sport: string | null | undefined, enabled: boolean) => {
    mockLiveEnabled(gameId, enabled);
    return { data: enabled ? mockLive() : undefined };
  },
}));

function checkedIn(over: { status?: string; sport?: string; rooting?: string | null } = {}) {
  return [
    {
      status: 'attended',
      verified_via: 'checkin',
      rooting_team_id: over.rooting === undefined ? 'phi' : over.rooting,
      game: {
        id: GAME,
        sport_id: over.sport ?? 'mlb',
        status: over.status ?? 'live',
        scheduled_start: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        home_team_id: 'phi',
        away_team_id: 'nym',
      },
    },
  ];
}

function liveRow(over: Record<string, unknown> = {}) {
  return {
    status: 'live',
    inning: 8,
    inning_state: 'top',
    home_score: 1,
    away_score: 4,
    locked: true,
    lock_reason: null,
    fetched_at: new Date().toISOString(),
    ...over,
  };
}

const wordmark = (
  <RallyCapWordmark>
    <Text>JINX</Text>
  </RallyCapWordmark>
);

beforeEach(async () => {
  mockFocused = true;
  mockListener = null;
  mockRemove.mockClear();
  mockLiveEnabled.mockClear();
  mockAttendances.mockReturnValue([]);
  mockLive.mockReturnValue(liveRow());
  resetAccelerometerCache();
  useAuthStore.setState({ userId: ME });
  useEggStore.setState({ curseCelebrated: {}, rallyCaps: {}, confettiGames: [] });
  useEggPreview.setState({ confetti: null });
  await useEggStore.persist.rehydrate();
});

describe('rally cap', () => {
  it('is only the wordmark when the person is not at a game: no wrapper, no sensor, no poll', async () => {
    const screen = await render(wordmark);
    expect(screen.getByText('JINX')).toBeTruthy();
    expect(screen.queryByTestId('rally-cap-wordmark')).toBeNull();
    expect(mockListener).toBeNull();
    expect(mockLiveEnabled).not.toHaveBeenCalled();
  });

  it('flips on a one second hold when the side is behind late, and remembers the game', async () => {
    mockAttendances.mockReturnValue(checkedIn());
    const screen = await render(wordmark);
    const cap = await waitFor(() => screen.getByTestId('rally-cap-wordmark'));
    expect(cap.props.accessibilityLabel).toMatch(/rally cap/i);

    await fireEvent(cap, 'longPress');
    expect(useEggStore.getState().rallyCaps[ME]?.[GAME]).toMatchObject({ teamId: 'phi' });
    // Flipped: the hold and the sensor are both done with.
    expect(mockListener).toBeNull();
  });

  it('listens for a shake only while it could mean something, and a shake flips it', async () => {
    mockAttendances.mockReturnValue(checkedIn());
    await render(wordmark);
    await waitFor(() => expect(mockListener).not.toBeNull());

    await act(async () => {
      const now = Date.now();
      jest
        .spyOn(Date, 'now')
        .mockReturnValueOnce(now)
        .mockReturnValueOnce(now + 150);
      for (let i = 0; i < 3; i += 1) mockListener?.({ x: 2.2, y: 1.5, z: 1 });
    });
    jest.restoreAllMocks();
    expect(useEggStore.getState().rallyCaps[ME]?.[GAME]).toBeTruthy();
    expect(mockListener).toBeNull();
    expect(mockRemove).toHaveBeenCalled();
  });

  it('does not listen when the side is ahead, early, neutral, or the Passport is not in front', async () => {
    mockAttendances.mockReturnValue(checkedIn());
    mockLive.mockReturnValue(liveRow({ home_score: 6 }));
    const ahead = await render(wordmark);
    await waitFor(() => ahead.getByTestId('rally-cap-wordmark'));
    expect(mockListener).toBeNull();
    await fireEvent(ahead.getByTestId('rally-cap-wordmark'), 'longPress');
    expect(useEggStore.getState().rallyCaps[ME]).toBeUndefined();
    await ahead.unmount();

    mockLive.mockReturnValue(liveRow({ inning: 5 }));
    const early = await render(wordmark);
    await waitFor(() => early.getByTestId('rally-cap-wordmark'));
    expect(mockListener).toBeNull();
    await early.unmount();

    mockLive.mockReturnValue(liveRow());
    mockAttendances.mockReturnValue(checkedIn({ rooting: null }));
    const neutral = await render(wordmark);
    await waitFor(() => neutral.getByTestId('rally-cap-wordmark'));
    expect(mockListener).toBeNull();
    await neutral.unmount();

    mockFocused = false;
    mockAttendances.mockReturnValue(checkedIn());
    const away = await render(wordmark);
    await waitFor(() => away.getByTestId('rally-cap-wordmark'));
    expect(mockListener).toBeNull();
  });

  it('never polls live state for a sport with no feed (the NFL reads ESPN since 2026-09-23)', async () => {
    mockAttendances.mockReturnValue(checkedIn({ sport: 'nhl' }));
    const screen = await render(wordmark);
    await waitFor(() => screen.getByTestId('rally-cap-wordmark'));
    expect(mockLiveEnabled).toHaveBeenCalledWith(GAME, false);
    expect(mockListener).toBeNull();
  });

  it('stays flipped across a restart until the game is final', async () => {
    useEggStore.setState({ rallyCaps: { [ME]: { [GAME]: { teamId: 'phi', at: Date.now() } } } });
    mockAttendances.mockReturnValue(checkedIn());
    const during = await render(wordmark);
    await waitFor(() => during.getByTestId('rally-cap-wordmark'));
    await during.unmount();

    mockAttendances.mockReturnValue(checkedIn({ status: 'final' }));
    const after = await render(wordmark);
    await act(async () => {});
    expect(after.queryByTestId('rally-cap-wordmark')).toBeNull();
    expect(after.getByText('JINX')).toBeTruthy();
  });

  it('says it worked on the game page only when that side won', async () => {
    useEggStore.setState({ rallyCaps: { [ME]: { [GAME]: { teamId: 'phi', at: 1 } } } });
    const won = await render(<RallyCapWorked gameId={GAME} winnerTeamId="phi" />);
    expect(won.getByText('Rally cap worked.')).toBeTruthy();
    const lost = await render(<RallyCapWorked gameId={GAME} winnerTeamId="nym" />);
    expect(lost.queryByText('Rally cap worked.')).toBeNull();
    const other = await render(<RallyCapWorked gameId="game-2" winnerTeamId="phi" />);
    expect(other.queryByText('Rally cap worked.')).toBeNull();
  });
});

describe('stretch-time confetti', () => {
  it('mounts nothing at rest', async () => {
    const screen = await render(<StretchConfetti />);
    await act(async () => {});
    expect(screen.toJSON()).toBeNull();
  });

  it('showers once when the app opens in the middle of the seventh', async () => {
    mockAttendances.mockReturnValue(checkedIn());
    mockLive.mockReturnValue(liveRow({ inning: 7, inning_state: 'middle' }));
    const screen = await render(<StretchConfetti />);
    await waitFor(() => expect(screen.getByTestId('egg-confetti')).toBeTruthy());
    const pieces = screen.getByTestId('egg-confetti').children.length;
    expect(pieces).toBeGreaterThanOrEqual(24);
    expect(pieces).toBeLessThanOrEqual(36);
    expect(useEggStore.getState().confettiGames).toEqual([GAME]);
    await screen.unmount();

    // Once per game per device: opening the app again in the same break does nothing.
    const again = await render(<StretchConfetti />);
    await act(async () => {});
    expect(again.queryByTestId('egg-confetti')).toBeNull();
  });

  it('does nothing in any other half inning, or on a stale row', async () => {
    mockAttendances.mockReturnValue(checkedIn());
    mockLive.mockReturnValue(liveRow({ inning: 7, inning_state: 'bottom' }));
    const bottom = await render(<StretchConfetti />);
    await act(async () => {});
    expect(bottom.queryByTestId('egg-confetti')).toBeNull();
    await bottom.unmount();

    mockLive.mockReturnValue(
      liveRow({
        inning: 7,
        inning_state: 'middle',
        fetched_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      }),
    );
    const stale = await render(<StretchConfetti />);
    await act(async () => {});
    expect(stale.queryByTestId('egg-confetti')).toBeNull();
  });

  it('plays for the dev page on request, in either sport', async () => {
    const screen = await render(<StretchConfetti />);
    await act(async () => {
      useEggPreview.getState().playConfetti('nfl');
    });
    expect(screen.getByTestId('egg-confetti')).toBeTruthy();
    expect(useEggStore.getState().confettiGames).toEqual([]);
  });
});
