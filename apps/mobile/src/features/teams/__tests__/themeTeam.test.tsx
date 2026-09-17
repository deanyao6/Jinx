import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import React from 'react';

import { useAuthStore } from '@/features/auth/store';
import { profileKeys } from '@/features/profile/queries';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { ReferenceThemeProvider } from '@/theme/reference/TeamTheme';

import { AccentRoot } from '../AccentRoot';
import type { Team } from '../queries';
import { resolveThemeTeamId, THEME_TEAM_STORAGE_KEY, useThemeTeamStore } from '../themeStore';
import { ThemeTeamPicker } from '../ui/ThemeTeamPicker';

const USER = 'user-1';

function team(id: string, sport: string, name: string, nickname: string): Team {
  return {
    id,
    sport_id: sport,
    name,
    city: name.replace(` ${nickname}`, ''),
    nickname,
    abbreviation: id.toUpperCase(),
    franchise_id: `f-${id}`,
    active: true,
  };
}

// The static reference palettes are keyed 'phi' and 'sf', so these ids resolve to real colours.
const PHILLIES = team('phi', 'mlb', 'Philadelphia Phillies', 'Phillies');
const GIANTS = team('sf', 'mlb', 'San Francisco Giants', 'Giants');
const PHI_FILL = '#E81828';
const SF_FILL = '#FD5A1E';

function signIn(userId: string | null) {
  useAuthStore.setState({ userId, status: userId ? 'signedIn' : 'signedOut' });
}

beforeEach(async () => {
  useThemeTeamStore.setState({ byUser: {} });
  await AsyncStorage.clear();
  signIn(USER);
});

describe('which team the app wears', () => {
  const favorites = [PHILLIES, GIANTS];

  it('is the stored team while it is still a favourite', () => {
    expect(resolveThemeTeamId('sf', favorites)).toBe('sf');
  });

  it('falls back to the first favourite when the stored team was removed', () => {
    expect(resolveThemeTeamId('sf', [PHILLIES])).toBe('phi');
  });

  it('is the first favourite when nothing is stored', () => {
    expect(resolveThemeTeamId(null, favorites)).toBe('phi');
    expect(resolveThemeTeamId(undefined, favorites)).toBe('phi');
  });

  it('is nobody with no favourites, stored or not', () => {
    expect(resolveThemeTeamId('sf', [])).toBeUndefined();
    expect(resolveThemeTeamId(null, undefined)).toBeUndefined();
  });
});

describe('the stored pick', () => {
  it('is kept per user, so two accounts on one phone do not share it', () => {
    useThemeTeamStore.getState().setThemeTeam('a', 'phi');
    useThemeTeamStore.getState().setThemeTeam('b', 'sf');
    expect(useThemeTeamStore.getState().byUser).toEqual({ a: 'phi', b: 'sf' });
    useThemeTeamStore.getState().setThemeTeam('a', null);
    expect(useThemeTeamStore.getState().byUser).toEqual({ b: 'sf' });
  });

  it('is written to AsyncStorage', async () => {
    useThemeTeamStore.getState().setThemeTeam(USER, 'sf');
    await act(async () => {
      await Promise.resolve();
    });
    const raw = await AsyncStorage.getItem(THEME_TEAM_STORAGE_KEY);
    expect(JSON.parse(raw ?? '{}').state.byUser).toEqual({ [USER]: 'sf' });
  });
});

function accentWrapper(favorites: Team[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });
  client.setQueryData(profileKeys.favorites(USER), favorites);
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <ThemeProvider scheme="light">
          <AccentRoot>{children}</AccentRoot>
        </ThemeProvider>
      </QueryClientProvider>
    );
  };
}

describe('AccentRoot', () => {
  it('wears the first favourite until one is picked, then the picked one at once', async () => {
    const { result } = await renderHook(() => useTheme(), {
      wrapper: accentWrapper([PHILLIES, GIANTS]),
    });
    expect(result.current.accent.fill).toBe(PHI_FILL);
    await act(async () => {
      useThemeTeamStore.getState().setThemeTeam(USER, 'sf');
    });
    expect(result.current.accent.fill).toBe(SF_FILL);
  });

  it('ignores a stored team that is no longer a favourite, and leaves the store alone', async () => {
    useThemeTeamStore.getState().setThemeTeam(USER, 'sf');
    const { result } = await renderHook(() => useTheme(), { wrapper: accentWrapper([PHILLIES]) });
    expect(result.current.accent.fill).toBe(PHI_FILL);
    expect(useThemeTeamStore.getState().byUser[USER]).toBe('sf');
  });

  it("does not wear another account's pick", async () => {
    useThemeTeamStore.getState().setThemeTeam('someone-else', 'sf');
    const { result } = await renderHook(() => useTheme(), {
      wrapper: accentWrapper([PHILLIES, GIANTS]),
    });
    expect(result.current.accent.fill).toBe(PHI_FILL);
  });

  it('is neutral with no favourites', async () => {
    useThemeTeamStore.getState().setThemeTeam(USER, 'sf');
    const { result } = await renderHook(() => useTheme(), { wrapper: accentWrapper([]) });
    expect(result.current.accent.themed).toBe(false);
  });
});

function renderPicker(teams: Team[]) {
  return render(
    <ThemeProvider scheme="light">
      <ReferenceThemeProvider scheme="light">
        <ThemeTeamPicker teams={teams} />
      </ReferenceThemeProvider>
    </ThemeProvider>,
  );
}

describe('ThemeTeamPicker', () => {
  it('draws nothing with fewer than two favourites', async () => {
    await renderPicker([PHILLIES]);
    expect(screen.queryByText('App color')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('marks the first favourite until another is picked', async () => {
    await renderPicker([PHILLIES, GIANTS]);
    expect(screen.getByText('App color')).toBeTruthy();
    expect(screen.getByLabelText('Use Philadelphia Phillies colors')).toBeSelected();
    expect(screen.getByLabelText('Use San Francisco Giants colors')).not.toBeSelected();
  });

  it('stores the team that is tapped, for the signed-in user', async () => {
    await renderPicker([PHILLIES, GIANTS]);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Use San Francisco Giants colors'));
    });
    expect(useThemeTeamStore.getState().byUser).toEqual({ [USER]: 'sf' });
    expect(screen.getByLabelText('Use San Francisco Giants colors')).toBeSelected();
    expect(screen.getByLabelText('Use Philadelphia Phillies colors')).not.toBeSelected();
  });
});
