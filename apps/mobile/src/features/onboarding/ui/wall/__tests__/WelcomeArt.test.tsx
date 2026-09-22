import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { IPHONE_17_PRO } from '@/test/renderScreen';

import { WelcomeArt } from '../../WelcomeArt';
import { COLUMNS, GAME_SLOTS } from '../columns';
import { FALLBACK_CARDS } from '../fallback';
import { WALL_CARD_COUNT } from '../types';

function mount(frozen: boolean) {
  return render(
    <SafeAreaProvider initialMetrics={IPHONE_17_PRO}>
      <WelcomeArt frozen={frozen}>
        <Text>Sign in with Apple</Text>
      </WelcomeArt>
    </SafeAreaProvider>,
  );
}

describe('WelcomeArt', () => {
  it('the three columns hold exactly six game slots, in the reference order, and nothing random', () => {
    expect(GAME_SLOTS).toBe(WALL_CARD_COUNT);
    expect(COLUMNS.map((c) => c.map((s) => s.kind))).toEqual([
      ['game', 'seal', 'stub', 'moment', 'photo', 'buddy', 'game'],
      ['live', 'stub', 'game', 'seal', 'pledge', 'ghost', 'game', 'photo'],
      ['streak', 'game', 'seal', 'wrapped', 'game', 'buddy', 'moment', 'seal'],
    ]);
    const src = String(COLUMNS);
    expect(src).not.toMatch(/random/);
  });

  it('frozen, draws the bundled six twice each and the copy in front, counters settled', async () => {
    await mount(true);
    // The wall is hidden from accessibility, which the queries respect by default.
    const hidden = { includeHiddenElements: true };
    for (const c of FALLBACK_CARDS) expect(screen.getAllByText(c.title, hidden)).toHaveLength(2);
    expect(screen.getAllByText('Walk-off, 9th', hidden)).toHaveLength(2);
    expect(screen.getAllByText('STAMP NOT YET EARNED', hidden)).toHaveLength(2);
    expect(screen.getByText('JINX')).toBeTruthy();
    expect(screen.getByText('You were there. Prove it.')).toBeTruthy();
    expect(screen.getByText('You must be 13 or older to use Jinx.')).toBeTruthy();
    expect(screen.getByLabelText('48 games. 14 stadiums. One record.')).toBeTruthy();
    expect(screen.getByText('48')).toBeTruthy();
    expect(screen.getByText('14')).toBeTruthy();
  });

  it('live, with no cache, draws the bundle once the cache has been read', async () => {
    await mount(false);
    const hidden = { includeHiddenElements: true };
    expect(await screen.findAllByText(FALLBACK_CARDS[0]!.title, hidden)).toHaveLength(2);
    expect(await screen.findAllByText(FALLBACK_CARDS[5]!.title, hidden)).toHaveLength(2);
  });

  it('the wall is hidden from the screen reader; the headline, actions and age line are not', async () => {
    await mount(true);
    const art = screen.getByTestId('welcome-art');
    const wall = art.children[0] as { props: Record<string, unknown> };
    expect(wall.props['accessibilityElementsHidden']).toBe(true);
    expect(wall.props['importantForAccessibility']).toBe('no-hide-descendants');
    expect(screen.getByRole('header', { name: '48 games. 14 stadiums. One record.' })).toBeTruthy();
  });
});
