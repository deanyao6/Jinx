import { renderHook } from '@testing-library/react-native';
import React from 'react';

import { alpha, luminance } from '../color';
import { ReferenceThemeProvider, TeamTheme } from '../reference/TeamTheme';
import { ThemeProvider, useTheme } from '../ThemeProvider';
import { darkColors, lightColors } from '../tokens';

function wrap(team: string | undefined, scheme: 'light' | 'dark', nested?: string) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider scheme={scheme}>
        <ReferenceThemeProvider team={team} scheme={scheme}>
          {nested ? <TeamTheme team={nested}>{children}</TeamTheme> : children}
        </ReferenceThemeProvider>
      </ThemeProvider>
    );
  };
}

describe('the accent on screens outside the reference', () => {
  it('is ink when no team is in scope, which is what these screens used before', async () => {
    const { result } = await renderHook(() => useTheme(), { wrapper: wrap(undefined, 'light') });
    expect(result.current.accent.themed).toBe(false);
    expect(result.current.accent.fill).toBe(lightColors.ink);
    expect(result.current.accent.onFill).toBe(lightColors.onInk);
  });

  it('is ink with no provider at all, as in a component test', async () => {
    const { result } = await renderHook(() => useTheme());
    expect(result.current.accent.themed).toBe(false);
  });

  it('takes the team in scope, and a nested team wins', async () => {
    const phi = await renderHook(() => useTheme(), { wrapper: wrap('phi', 'light') });
    expect(phi.result.current.accent.fill).toBe('#E81828');
    expect(phi.result.current.accent.text).toBe('#E81828');
    const nested = await renderHook(() => useTheme(), { wrapper: wrap('phi', 'light', 'sf') });
    expect(nested.result.current.accent.fill).toBe('#FD5A1E');
  });

  it('uses the dark-tuned accent as text in dark mode', async () => {
    const { result } = await renderHook(() => useTheme(), { wrapper: wrap('phi', 'dark') });
    expect(result.current.accent.text).toBe('#FF3B49');
    expect(result.current.accent.fill).toBe('#E81828');
  });

  it('does not fill a button with a colour the dark screen would swallow', async () => {
    // The Bears' navy is #0B162A; the dark canvas is #101216.
    const { result } = await renderHook(() => useTheme(), { wrapper: wrap('chi', 'dark') });
    expect(result.current.accent.fill).toBe('#E8692F');
    expect(result.current.accent.onFill).toBe(darkColors.screen);
    const light = await renderHook(() => useTheme(), { wrapper: wrap('chi', 'light') });
    expect(light.result.current.accent.fill).toBe('#0B162A');
  });
});

describe('colour helpers', () => {
  it('washes a hex colour out to an rgba', () => {
    expect(alpha('#E81828', 0.1)).toBe('rgba(232,24,40,0.1)');
    expect(alpha('not-a-colour', 0.1)).toBe('not-a-colour');
  });

  it('measures luminance', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(luminance('#0B162A')).toBeLessThan(0.035);
    expect(luminance('#E81828')).toBeGreaterThan(0.035);
  });
});
