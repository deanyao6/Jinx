import { Stack } from 'expo-router';
import React from 'react';

import { LegacyBackButton } from '@/components/reference/BackHeader';
import { useTheme } from '@/theme/ThemeProvider';

export default function ShareStackLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackButtonDisplayMode: 'minimal',
        // These screens are the first entry in their own nested stack whenever they are
        // opened from a tab, so the navigator draws no back button and the only way out
        // was the edge-swipe gesture. An explicit headerLeft is always visible, and it
        // falls back to the Passport tab when a deep link opened the screen cold.
        headerLeft: () => <LegacyBackButton fallback="/" />,
        headerTintColor: theme.colors.ink,
        headerStyle: { backgroundColor: theme.colors.screen },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="[template]" options={{ title: 'Share' }} />
    </Stack>
  );
}
