import { Stack } from 'expo-router';
import React from 'react';

/**
 * The reaction camera opens over the tabs, full screen, from a push or a prompt. The layout
 * makes the folder one route the root navigator can guard (features/navigation/RootStack.tsx).
 */
export default function ReactStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
