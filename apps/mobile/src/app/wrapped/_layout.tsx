import { Stack } from 'expo-router';
import React from 'react';

export default function WrappedStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[sport]/[season]" />
    </Stack>
  );
}
