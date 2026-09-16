import { Stack } from 'expo-router';
import React from 'react';

export const unstable_settings = { initialRouteName: 'index' };

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="teams" />
      <Stack.Screen name="city" />
      <Stack.Screen name="birthday" />
      <Stack.Screen name="past-games" />
    </Stack>
  );
}
