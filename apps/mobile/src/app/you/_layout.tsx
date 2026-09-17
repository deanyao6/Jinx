import { Stack } from 'expo-router';
import React from 'react';

import { UnderHeader, useSubPageHeader } from '@/components/subPageHeader';

export default function YouStackLayout() {
  const header = useSubPageHeader('/settings');
  return (
    <UnderHeader>
      <Stack screenOptions={header}>
        <Stack.Screen name="edit-profile" options={{ title: 'Edit profile' }} />
        <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
        <Stack.Screen name="forwarding" options={{ title: 'Forwarding address' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="notification-settings" options={{ title: 'Notification settings' }} />
        <Stack.Screen name="blocked" options={{ title: 'Blocked users' }} />
        <Stack.Screen name="about" options={{ title: 'About' }} />
        <Stack.Screen name="terms" options={{ title: 'Terms of use' }} />
        <Stack.Screen name="privacy-policy" options={{ title: 'Privacy policy' }} />
        <Stack.Screen name="delete-account" options={{ title: 'Delete account' }} />
      </Stack>
    </UnderHeader>
  );
}
