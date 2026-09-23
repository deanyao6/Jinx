import { router, Stack, type Href } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import React from 'react';
import { Text } from 'react-native';

import TabStackLayout, {
  unstable_settings as tabStackSettings,
} from '@/app/(tabs)/(feed,passport,games,plan,profile)/_layout';
import TabLayout from '@/app/(tabs)/_layout';
import NotFound from '@/app/+not-found';
import { ReferenceThemeProvider } from '@/theme/reference/TeamTheme';
import { useToastStore } from '../toast';
import { ownedHref, ownerTab, systemPathToHref } from '../tabs';

/**
 * The five-tab navigation (docs/prompts/social/01, sections 1 and 2), with the real tab layout,
 * the real per-tab stack and the real tab bar, and a stub for every screen.
 */
const page = (label: string) =>
  function Page() {
    return <Text>{label}</Text>;
  };

const S = '(tabs)/(feed,passport,games,plan,profile)';
const routes = {
  // The app's root puts the person's team in scope (AccentRoot); the tab bar reads it.
  _layout: () => (
    <ReferenceThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ReferenceThemeProvider>
  ),
  '+not-found': NotFound,
  '(tabs)/_layout': TabLayout,
  [`${S}/_layout`]: { default: TabStackLayout, unstable_settings: tabStackSettings },
  '(tabs)/(feed)/feed': page('feed root'),
  '(tabs)/(feed)/communities': page('communities'),
  '(tabs)/(passport)/index': page('passport root'),
  '(tabs)/(passport)/passport/stamps': page('stamps'),
  '(tabs)/(games)/games': page('games root'),
  '(tabs)/(games)/games/imports': page('imports'),
  '(tabs)/(plan)/plan': page('plan root'),
  '(tabs)/(profile)/profile': page('profile root'),
  '(tabs)/(profile)/settings/index': page('settings'),
  [`${S}/games/[gameId]`]: page('game'),
  [`${S}/relive/[gameId]`]: page('relive'),
  [`${S}/u/[handle]`]: page('someone'),
};

type App = ReturnType<typeof renderRouter>;
type NavState = { index?: number; routes: { name: string; state?: NavState }[] };

const expectPath = (app: App, path: string) => waitFor(() => expect(app).toHavePathname(path));

/** The screens stacked in one tab, bottom first. */
function tabStack(app: App, tab: string): string[] {
  const root = app.getRouterState() as unknown as NavState;
  const tabs = root.routes[0]?.state?.routes.find((r) => r.name === '(tabs)')?.state;
  const group = tabs?.routes.find((r) => r.name === `(${tab})`);
  return group?.state?.routes.map((r) => r.name) ?? [];
}

const push = (href: string) => act(async () => router.push(href as Href));
const pressTab = (label: string) => act(async () => fireEvent.press(screen.getByLabelText(label)));

describe('which tab owns a path', () => {
  it.each([
    ['/feed', 'feed'],
    ['/post/p1/comments', 'feed'],
    ['/community/phillies/leaderboard?stat=games', 'feed'],
    ['/u/maya', 'feed'],
    ['/', 'passport'],
    ['/passport/badges', 'passport'],
    ['/games/g1', 'games'],
    ['/relive/g1', 'games'],
    ['/guide/v1', 'games'],
    ['/plan', 'plan'],
    ['/settings/favorites', 'profile'],
    ['/you/about', 'profile'],
    ['/friends/find', 'profile'],
  ])('%s belongs to %s', (path, tab) => {
    expect(ownerTab(path)).toBe(tab);
  });

  it('leaves routes outside the tabs alone', () => {
    for (const path of ['/wrapped/mlb/2025', '/share/game', '/invite/abc', '/react/g1', '/welcome']) {
      expect(ownerTab(path)).toBeNull();
      expect(ownedHref(path)).toBe(path);
    }
  });

  it('leaves an unknown path for the not-found route', () => {
    expect(ownerTab('/no/such/place')).toBeNull();
    expect(systemPathToHref('jinx:///no/such/place')).toBe('/no/such/place');
  });

  it('spells out the group and keeps the query', () => {
    expect(ownedHref('/games/g1?scroll=end')).toBe('/(tabs)/(games)/games/g1?scroll=end');
    expect(ownedHref('/')).toBe('/(tabs)/(passport)');
    expect(ownedHref('/(tabs)/(feed)/games/g1')).toBe('/(tabs)/(feed)/games/g1');
  });

  it('rewrites only the app scheme and bare paths', () => {
    expect(systemPathToHref('jinx:///relive/g1?step=9')).toBe('/(tabs)/(games)/relive/g1?step=9');
    expect(systemPathToHref('jinx://u/maya')).toBe('/(tabs)/(feed)/u/maya');
    expect(systemPathToHref('/settings?signOut=1')).toBe('/(tabs)/(profile)/settings?signOut=1');
    expect(systemPathToHref('jinx:///parity/passport')).toBe('/parity/passport');
    const dev = 'exp+jinx://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081';
    expect(systemPathToHref(dev)).toBe(dev);
  });
});

// expo-router's testing library keeps one router store per file, so the journeys run in one render.
describe('five tab stacks', () => {
  it('deep links, shared routes, tab memory and pop to root', async () => {
    // A cold deep link to a game lands on the Games stack with the Games list under it.
    const app = renderRouter(routes, { initialUrl: systemPathToHref('jinx:///games/g1') });
    await expectPath(app, '/games/g1');
    expect(tabStack(app, 'games')).toEqual(['games', 'games/[gameId]']);
    await act(async () => router.back());
    await expectPath(app, '/games');

    // Five tabs in order, Feed first.
    expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual([
      'Feed',
      'Passport',
      'Games',
      'Plan',
      'Profile',
    ]);

    // Games: open a game and its Relive, then leave the tab.
    await push('/games/g2');
    await push('/relive/g2');
    await expectPath(app, '/relive/g2');

    // The Feed: a profile and a game opened from here stay on the Feed's stack.
    await pressTab('Feed');
    await expectPath(app, '/feed');
    await push('/u/maya');
    await push('/games/g3');
    await expectPath(app, '/games/g3');
    expect(tabStack(app, 'feed')).toEqual(['feed', 'u/[handle]', 'games/[gameId]']);
    await act(async () => router.back());
    await expectPath(app, '/u/maya');

    // Back to Games: its stack is where it was left.
    await pressTab('Games');
    await expectPath(app, '/relive/g2');
    expect(tabStack(app, 'games')).toEqual(['games', 'games/[gameId]', 'relive/[gameId]']);

    // Tapping the tab that is showing pops it to its root; the Feed keeps its own place.
    await pressTab('Games');
    await expectPath(app, '/games');
    expect(tabStack(app, 'games')).toEqual(['games']);
    await pressTab('Feed');
    await expectPath(app, '/u/maya');

    // A route one tab owns switches to that tab: settings from the Feed opens on Profile.
    await push('/settings');
    await expectPath(app, '/settings');
    expect(tabStack(app, 'profile')).toEqual(['profile', 'settings/index']);
    expect(tabStack(app, 'feed')).toEqual(['feed', 'u/[handle]']);

    // A segment is a param rewritten in place: no new screen on the stack.
    await pressTab('Games');
    await act(async () => router.setParams({ segment: 'upcoming' }));
    expect(tabStack(app, 'games')).toEqual(['games']);

    // An unknown link lands on the Passport with a toast, not an error screen.
    await push(systemPathToHref('jinx:///no/such/place'));
    await expectPath(app, '/');
    await waitFor(() => expect(useToastStore.getState().message).toMatch(/does not go anywhere/));
    await act(async () => useToastStore.getState().clear());
  });
});
