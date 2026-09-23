import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import EasterEggsScreen from '@/app/(tabs)/(profile)/you/eggs';
import { EGG_CATALOG } from '@/features/eggs/catalog';
import { eggs } from '@/features/eggs/flags';
import { useEggPreview } from '@/features/eggs/store';

const mockParams: { play?: string; sport?: string } = {};
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useIsFocused: () => true,
  useLocalSearchParams: () => mockParams,
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

function renderPage() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 402, height: 874 },
        insets: { top: 62, left: 0, right: 0, bottom: 34 },
      }}
    >
      <EasterEggsScreen />
    </SafeAreaProvider>,
  );
}

const dev = globalThis as unknown as { __DEV__: boolean };

afterEach(() => {
  dev.__DEV__ = true;
  delete mockParams.play;
  delete mockParams.sport;
  jest.useRealTimers();
});

describe('the egg catalog', () => {
  it('names only real switches, each once', () => {
    const keys = EGG_CATALOG.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(typeof eggs[key]).toBe('boolean');
  });

  it('has something to play for each of the four animated eggs', () => {
    const playable = EGG_CATALOG.filter((entry) => entry.Preview).map((entry) => entry.key);
    expect(playable).toEqual(
      expect.arrayContaining(['recordRewind', 'curseBreaker', 'rallyCap', 'stretchConfetti']),
    );
  });
});

describe('the dev page', () => {
  it('shows one egg and starts it by itself for ?play=<key>', async () => {
    // Nothing can tap Play in the simulator, so the deep link is how an egg gets looked at.
    jest.useFakeTimers();
    mockParams.play = 'rallyCap';
    const screen = await renderPage();
    expect(screen.getByText('Rally cap')).toBeTruthy();
    expect(screen.queryByText('Record rewind')).toBeNull();
    expect(screen.getByText('Play')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(screen.getByText('Flip back')).toBeTruthy();
  });

  it('lists every egg with its switch, and plays them on sample data', async () => {
    jest.useFakeTimers();
    const screen = await renderPage();
    for (const entry of EGG_CATALOG) expect(screen.getByText(entry.title)).toBeTruthy();
    expect(screen.getAllByText('On').length).toBe(EGG_CATALOG.filter((e) => eggs[e.key]).length);

    const [rewind, shatter] = screen.getAllByText('Play');
    // The sample record rewinds and replays its twelve games without a finger on it.
    expect(screen.getAllByText('8 – 4').length).toBe(2);
    await fireEvent.press(rewind!);
    expect(screen.getAllByText('8 – 4').length).toBe(1);
    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    expect(screen.getAllByText('8 – 4').length).toBe(2);

    await fireEvent.press(shatter!);
    expect(screen.getByTestId('curse-shatter')).toBeTruthy();
    expect(screen.getByText('Curse broken. 6 straight losses, over.')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(6000);
    });
    expect(screen.queryByTestId('curse-shatter')).toBeNull();

    await fireEvent.press(screen.getByText(/Play NFL/));
    expect(useEggPreview.getState().confetti).toMatchObject({ sport: 'nfl' });
    await fireEvent.press(screen.getByText(/Play MLB/));
    expect(useEggPreview.getState().confetti).toMatchObject({ sport: 'mlb' });
  });

  it('is an empty page in a production build', async () => {
    dev.__DEV__ = false;
    const screen = await renderPage();
    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(screen.queryByText('Record rewind')).toBeNull();
    expect(screen.queryByText('Play')).toBeNull();
  });
});
