import { Stack } from 'expo-router';
import React from 'react';

import { LegacyBackButton } from '@/components/reference/BackHeader';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

export default function YouStackLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackButtonDisplayMode: 'minimal',
        // These screens are the first entry in their own nested stack whenever they are
        // opened from a tab, so the navigator draws no back button and the only way out
        // was the edge-swipe gesture. An explicit headerLeft is always visible, and it
        // falls back to the settings index these pages hang off when a deep link
        // opened one of them cold.
        headerLeft: () => <LegacyBackButton fallback="/settings" />,
        headerTintColor: theme.colors.ink,
        headerStyle: { backgroundColor: theme.colors.screen },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fontFamily({ weight: 700 }) },
      }}
    >
      <Stack.Screen name="edit-profile" options={{ title: 'Edit profile' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
      <Stack.Screen name="forwarding" options={{ title: 'Forwarding address' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="notification-settings" options={{ title: 'Notification settings' }} />
      <Stack.Screen name="blocked" options={{ title: 'Blocked users' }} />
      <Stack.Screen name="about" options={{ title: 'About' }} />
      <Stack.Screen name="terms" options={{ title: 'Terms of use' }} />
      <Stack.Screen name="privacy-policy" options={{ title: 'Privacy policy' }} />
      <Stack.Screen name="delete-account" options={{ title: 'Delete account' }} />
    </Stack>
  );
}
