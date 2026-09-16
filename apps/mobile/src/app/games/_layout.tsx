import { Stack } from 'expo-router';
import React from 'react';

import { LegacyBackButton } from '@/components/reference/BackHeader';
import { useTheme } from '@/theme/ThemeProvider';

export default function GamesStackLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackButtonDisplayMode: 'minimal',
        // These screens are the first entry in their own nested stack whenever they are
        // opened from a tab, so the navigator draws no back button and the only way out
        // was the edge-swipe gesture. An explicit headerLeft is always visible, and it
        // falls back to the Games tab when a deep link opened the screen cold.
        headerLeft: () => <LegacyBackButton fallback="/games" />,
        headerTintColor: theme.colors.ink,
        headerStyle: { backgroundColor: theme.colors.screen },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="[gameId]" options={{ title: 'Game' }} />
      <Stack.Screen name="log/[gameId]" options={{ title: 'Log game', presentation: 'modal' }} />
      <Stack.Screen name="bulk" options={{ title: 'Log a season' }} />
      <Stack.Screen name="checkin/[gameId]" options={{ title: 'Check in' }} />
      <Stack.Screen name="imports" options={{ title: 'Imports' }} />
      <Stack.Screen name="import" options={{ title: 'Upload tickets' }} />
    </Stack>
  );
}
