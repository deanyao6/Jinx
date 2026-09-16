import { Stack } from 'expo-router';
import React from 'react';

import { LegacyBackButton } from '@/components/reference/BackHeader';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

export default function PassportStackLayout() {
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
        headerTitleStyle: { fontFamily: fontFamily({ weight: 700 }) },
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
