import { Stack } from 'expo-router';
import React from 'react';

import { useTheme } from '@/theme/ThemeProvider';

export default function ProfileStackLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: theme.colors.ink,
        headerStyle: { backgroundColor: theme.colors.screen },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="[handle]" options={{ title: 'Profile' }} />
    </Stack>
  );
}
