import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavThemeProvider,
} from '@react-navigation/native';
import Constants from 'expo-constants';
import { Stack, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, LogBox, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useAuth, useAuthListener, useSignOut } from '@/features/auth/hooks';
import { useNavStore } from '@/features/nav/store';
import { ParityHost } from '@/features/parity/ParityHost';
import { useTeamPalettes } from '@/features/teams/queries';
import { useNotificationRuntime } from '@/features/notifications/push';
import { useProfile } from '@/features/profile/queries';
import { initSentry, wrapRoot } from '@/lib/sentry';
import { useJinxFonts } from '@/theme/fonts';
import { TeamPaletteProvider } from '@/theme/reference/TeamTheme';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { darkColors, lightColors } from '@/theme/tokens';

initSentry();

// Hold the native splash until the Archivo instances are registered (SPEC.md 8.2). Without this
// the first frame paints in the system font and every heading visibly reflows a moment later.
// It is released in RootNavigator as soon as the fonts settle, loaded or failed, so a font error
// can never leave the app stuck on the splash. Rejection only means the splash was already gone.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Simulator only: the build is unsigned (no Apple developer certificate yet), so the app has no
// keychain entitlement and expo-notifications cannot read its stored registration. Push does not
// work in a simulator regardless. Silencing it keeps the dev overlay clear; on a signed device
// build the message does not occur. See docs/simulator.md.
if (__DEV__) {
  LogBox.ignoreLogs([/\[expo-notifications\] Error reading persisted server registration info/]);
}

/** How long persisted queries stay usable offline. gcTime must cover it or they are dropped. */
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, gcTime: CACHE_MAX_AGE } },
});

/**
 * Offline (SPEC.md M10): the query cache is written to AsyncStorage so the Passport tab and
 * History render from disk before any network call. Queries whose data is not plain JSON (Maps)
 * and short-lived lookups are skipped.
 */
const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'jinx-query-cache',
  throttleTime: 1000,
});

const SKIP_PERSIST = new Set(['checkin', 'imports']);

const persistOptions = {
  persister,
  maxAge: CACHE_MAX_AGE,
  buster: Constants.expoConfig?.version ?? '0',
  dehydrateOptions: {
    shouldDehydrateQuery: (query: {
      queryKey: readonly unknown[];
      state: { status: string; data: unknown };
    }) =>
      query.state.status === 'success' &&
      !(query.state.data instanceof Map) &&
      !SKIP_PERSIST.has(String(query.queryKey[0])) &&
      query.queryKey[1] !== 'search' &&
      query.queryKey[1] !== 'handle',
  },
};

function Splash({
  error,
  onRetry,
  onSignOut,
}: {
  error?: boolean;
  onRetry?: () => void;
  onSignOut?: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.screen,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xl,
        gap: theme.spacing.md,
      }}
    >
      {error ? (
        <>
          <Text variant="h2" align="center">
            Could not load your profile
          </Text>
          <Text color="muted" align="center">
            Check your connection and try again.
          </Text>
          <Button title="Try again" onPress={onRetry} />
          <Button title="Sign out" variant="ghost" onPress={onSignOut} />
        </>
      ) : (
        <ActivityIndicator color={theme.colors.muted} />
      )}
    </View>
  );
}

function RootNavigator() {
  useNotificationRuntime();
  useAuthListener();
  const router = useRouter();
  const { status } = useAuth();
  const profile = useProfile();
  const signOut = useSignOut();
  const pendingRoute = useNavStore((s) => s.pendingRoute);
  const setPendingRoute = useNavStore((s) => s.setPendingRoute);

  const signedIn = status === 'signedIn';
  const onboarded = signedIn && !!profile.data?.onboarded_at;
  const profileReady = !signedIn || profile.data != null;

  useEffect(() => {
    if (onboarded && pendingRoute) {
      setPendingRoute(null);
      router.replace(pendingRoute as Href);
    }
  }, [onboarded, pendingRoute, router, setPendingRoute]);

  if (status === 'loading') return <Splash />;
  if (signedIn && profile.isError) {
    return <Splash error onRetry={() => profile.refetch()} onSignOut={signOut} />;
  }
  if (!profileReady) return <Splash />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="games" />
        <Stack.Screen name="you" />
        <Stack.Screen name="passport" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="u" />
        <Stack.Screen name="wrapped" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="share" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="invite" />
    </Stack>
  );
}

/**
 * Holds the splash until Archivo is registered, then releases it.
 *
 * This sits above ParityHost on purpose. ParityHost renders a parity screen *instead of*
 * its children, so with the font loading further down inside RootNavigator the hook never
 * ran in parity mode and the native splash stayed up forever. Fonts are app-wide, so they
 * belong above anything that can replace the tree.
 *
 * The splash is an ActivityIndicator with no text, so holding here cannot flash unstyled
 * type. Loaded or failed, there is nothing further to wait for: a font failure must not
 * be able to strand the app on the splash screen.
 */
/**
 * Supplies the full team palette set to everything below.
 *
 * It never blocks rendering: while the query is in flight, or when it fails, or in demo
 * mode where there is no backend, the theme falls through to the 14 static palettes and
 * then to neutral. A team is always themed, just possibly with the fallback.
 */
function TeamPalettes({ children }: { children: React.ReactNode }) {
  const palettes = useTeamPalettes();
  return <TeamPaletteProvider palettes={palettes.data}>{children}</TeamPaletteProvider>;
}

function FontGate({ children }: { children: React.ReactNode }) {
  const [fontsLoaded, fontError] = useJinxFonts();
  const settled = fontsLoaded || fontError != null;

  useEffect(() => {
    if (settled) void SplashScreen.hideAsync().catch(() => {});
  }, [settled]);

  if (!settled) return <Splash />;
  return <>{children}</>;
}

function RootLayout() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const c = dark ? darkColors : lightColors;
  const navTheme = {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(dark ? DarkTheme : DefaultTheme).colors,
      primary: c.ink,
      background: c.screen,
      card: c.screen,
      text: c.ink,
      border: c.line,
    },
  };
  return (
    // Outermost on purpose: react-native-gesture-handler only receives touches
    // below this view, so the slide-over panels and any pan gesture are dead
    // without it. It was missing entirely until the screens were wired up.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <ThemeProvider>
            <NavThemeProvider value={navTheme}>
              <StatusBar style={dark ? 'light' : 'dark'} />
              <FontGate>
                <TeamPalettes>
                  {/* Development only, and inert unless the visual parity harness is
                    running. See scripts/parity/ and SPEC.md M0.5. */}
                  <ParityHost>
                    <RootNavigator />
                  </ParityHost>
                </TeamPalettes>
              </FontGate>
            </NavThemeProvider>
          </ThemeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(RootLayout);
