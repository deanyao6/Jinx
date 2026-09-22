import { Stack } from 'expo-router';
import React from 'react';

import { UnderHeader, useSubPageHeader } from '@/components/subPageHeader';

export default function GamesStackLayout() {
  const header = useSubPageHeader('/games');
  return (
    <UnderHeader>
      <Stack screenOptions={header}>
        <Stack.Screen name="search" options={{ title: 'Find a game' }} />
        <Stack.Screen name="[gameId]" options={{ title: 'Game' }} />
        <Stack.Screen name="log/[gameId]" options={{ title: 'Log game', presentation: 'modal' }} />
        <Stack.Screen name="bulk" options={{ title: 'Log a season' }} />
        <Stack.Screen name="checkin/[gameId]" options={{ title: 'Check in' }} />
        <Stack.Screen name="imports" options={{ title: 'Imports' }} />
        <Stack.Screen name="import" options={{ title: 'Upload tickets' }} />
      </Stack>
    </UnderHeader>
  );
}
