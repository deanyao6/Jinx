import { Stack } from 'expo-router';
import React from 'react';

/**
 * The root navigator's guards. Which screens exist depends only on the session and whether the
 * profile has finished onboarding; expo-router removes a guarded screen the moment its guard
 * turns false and settles on the first screen that is still allowed.
 *
 * Every signed-in route has to be listed under the onboarded guard. A route left off the list is
 * still added, unguarded, and stays where it is after a sign out: that is how signing out from
 * Settings once left the app on Settings with an empty identity card instead of on the welcome
 * screen (Dean, build 4). `invite` is the one deliberate exception: an invite link has to open
 * while signed out.
 */
export function RootStack({ signedIn, onboarded }: { signedIn: boolean; onboarded: boolean }) {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="games" />
        <Stack.Screen name="you" />
        <Stack.Screen name="passport" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="u" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="guide" />
        <Stack.Screen name="relive" />
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
