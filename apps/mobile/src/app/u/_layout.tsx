import { Stack } from 'expo-router';
import React from 'react';

import { UnderHeader, useSubPageHeader } from '@/components/subPageHeader';

export default function ProfileStackLayout() {
  const header = useSubPageHeader('/profile');
  return (
    <UnderHeader>
      <Stack screenOptions={header}>
        <Stack.Screen name="[handle]" options={{ title: 'Profile' }} />
      </Stack>
    </UnderHeader>
  );
}
