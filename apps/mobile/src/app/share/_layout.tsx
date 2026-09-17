import { Stack } from 'expo-router';
import React from 'react';

import { UnderHeader, useSubPageHeader } from '@/components/subPageHeader';

export default function ShareStackLayout() {
  const header = useSubPageHeader('/');
  return (
    <UnderHeader>
      <Stack screenOptions={header}>
        <Stack.Screen name="[template]" options={{ title: 'Share' }} />
      </Stack>
    </UnderHeader>
  );
}
