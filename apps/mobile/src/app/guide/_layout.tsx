import { Stack } from 'expo-router';
import React from 'react';

/**
 * The stadium guide draws its own header, so this stack shows none. The layout exists so the folder is one
 * route group named `guide`, which the root navigator can guard as a whole: without it each file
 * is its own top-level route (`guide/...`) that no guard names, and a sign out leaves it on screen
 * (features/navigation/RootStack.tsx).
 */
export default function GuideStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
