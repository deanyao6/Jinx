import { Stack } from 'expo-router';
import React from 'react';

import { useTheme } from '@/theme/ThemeProvider';

export default function PassportStackLayout() {
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
      <Stack.Screen name="stamps" options={{ title: 'Stamps' }} />
      <Stack.Screen name="superlatives" options={{ title: 'Superlatives' }} />
      <Stack.Screen name="moments" options={{ title: 'Moments' }} />
      <Stack.Screen name="moment/[type]" options={{ title: 'Moment' }} />
      <Stack.Screen name="players" options={{ title: 'Players seen' }} />
      <Stack.Screen name="map" options={{ title: 'Map' }} />
      <Stack.Screen name="goals" options={{ title: 'Goals' }} />
      <Stack.Screen name="new-goal" options={{ title: 'New goal', presentation: 'modal' }} />
      <Stack.Screen name="bucketlists" options={{ title: 'Bucket lists' }} />
      <Stack.Screen name="bucketlist/[id]" options={{ title: 'Bucket list' }} />
      <Stack.Screen
        name="new-bucketlist"
        options={{ title: 'New bucket list', presentation: 'modal' }}
      />
    </Stack>
  );
}
