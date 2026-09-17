import { Stack } from 'expo-router';
import React from 'react';

import { UnderHeader, useSubPageHeader } from '@/components/subPageHeader';

export default function InviteStackLayout() {
  const header = useSubPageHeader('/');
  return (
    <UnderHeader>
      <Stack screenOptions={header}>
        <Stack.Screen name="[token]" options={{ title: 'Invite' }} />
      </Stack>
    </UnderHeader>
  );
}
