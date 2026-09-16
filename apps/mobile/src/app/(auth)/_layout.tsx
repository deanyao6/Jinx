import { Stack } from 'expo-router';
import React from 'react';

export const unstable_settings = { initialRouteName: 'welcome' };

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="email" />
      <Stack.Screen name="code" />
    </Stack>
  );
}
