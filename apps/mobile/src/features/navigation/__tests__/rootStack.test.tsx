import { Stack, Tabs, router, type Href } from 'expo-router';
import { act, renderRouter, waitFor } from 'expo-router/testing-library';
import React from 'react';
import { Text } from 'react-native';
import { create } from 'zustand';

import { RootStack } from '../RootStack';

/**
 * The session store the test flips. The real root layout reads the auth store; this one is a
 * stand-in with the same two facts the navigator depends on.
 */
const useSession = create<{ signedIn: boolean; onboarded: boolean }>(() => ({
  signedIn: true,
  onboarded: true,
}));

function Layout() {
  const { signedIn, onboarded } = useSession();
  return <RootStack signedIn={signedIn} onboarded={onboarded} />;
}

const page = (label: string) =>
  function Page() {
    return <Text>{label}</Text>;
  };

const group = () => <Stack screenOptions={{ headerShown: false }} />;

// A file map in the shape of app/: the five tab stacks, which one guard on `(tabs)` covers, the
// Wrapped modal that stays at the root (with the layout that makes its folder one route group: a
// folder without one is a set of separate top-level routes that a guard naming it never matches),
// and the welcome screen the (auth) group opens on (its layout pins that, as the real one does).
const S = '(tabs)/(feed,passport,games,plan,profile)';
const routes = {
  _layout: Layout,
  '(tabs)/_layout': () => <Tabs initialRouteName="(passport)" screenOptions={{ headerShown: false }} tabBar={() => null} />,
  [`${S}/_layout`]: { default: group, unstable_settings: { passport: { initialRouteName: 'index' } } },
  '(tabs)/(passport)/index': page('passport'),
  '(tabs)/(profile)/profile': page('profile'),
  '(tabs)/(profile)/settings/index': page('settings'),
  '(tabs)/(profile)/settings/favorites/index': page('favorites'),
  [`${S}/guide/[venueId]`]: page('guide'),
  [`${S}/relive/[gameId]`]: page('relive'),
  [`${S}/games/[gameId]`]: page('game'),
  'wrapped/_layout': group,
  'wrapped/[sport]/[season]': page('wrapped'),
  '(onboarding)/index': page('onboarding'),
  '(auth)/_layout': { default: group, unstable_settings: { initialRouteName: 'welcome' } },
  '(auth)/welcome': page('welcome'),
  '(auth)/email': page('email'),
  'invite/[code]': page('invite'),
};

type App = ReturnType<typeof renderRouter>;

/** React Navigation settles its state asynchronously; wait for the pathname rather than read it. */
const expectPathname = (app: App, pathname: string) =>
  waitFor(() => expect(app).toHavePathname(pathname));

const setSession = (signedIn: boolean, onboarded: boolean) =>
  act(async () => {
    useSession.setState({ signedIn, onboarded });
  });

/** The names of the screens in the root stack: what back could reach. */
const rootRoutes = (app: App) =>
  app.getRouterState()?.routes[0]?.state?.routes.map((r) => r.name) ?? [];
const expectRoutes = (app: App, names: string[]) =>
  waitFor(() => expect(rootRoutes(app)).toEqual(names));

// expo-router's testing library keeps one global router store, so a second renderRouter in the
// same file inherits the first one's state. Everything below therefore runs in one render.
describe('RootStack', () => {
  it('a session going to null lands on welcome, from anywhere, with nothing to go back to', async () => {
    const app = renderRouter(routes, { initialUrl: '/settings' });
    await expectPathname(app, '/settings');

    // The reported bug: sign out from Settings, which is a route outside the tabs.
    await setSession(false, false);
    await expectPathname(app, '/welcome');
    await expectRoutes(app, ['(auth)']);

    // Sign in again: the passport, with the auth screens gone.
    await setSession(true, true);
    await expectRoutes(app, ['(tabs)']);

    // The other routes that live outside the tabs.
    for (const href of ['/guide/abc', '/relive/abc', '/games/abc', '/settings/favorites', '/wrapped/mlb/2025']) {
      await act(async () => router.push(href as Href));
      await expectPathname(app, href);
      await setSession(false, false);
      await expectRoutes(app, ['(auth)']);
      await setSession(true, true);
      await expectPathname(app, '/');
    }

    // Sign out during onboarding goes to welcome too.
    await setSession(true, false);
    await expectRoutes(app, ['(onboarding)/index']);
    await setSession(false, false);
    await expectPathname(app, '/welcome');
    await expectRoutes(app, ['(auth)']);
  });
});
