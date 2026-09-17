import { Stack } from 'expo-router';
import React from 'react';

import { UnderHeader, useSubPageHeader } from '@/components/subPageHeader';

export default function FriendsStackLayout() {
  const header = useSubPageHeader('/profile');
  return (
    <UnderHeader>
      <Stack screenOptions={header}>
        <Stack.Screen name="find" options={{ title: 'Find people' }} />
        <Stack.Screen name="requests" options={{ title: 'Follow requests' }} />
        <Stack.Screen name="person/[id]" options={{ title: 'Companion' }} />
      </Stack>
    </UnderHeader>
  );
}
