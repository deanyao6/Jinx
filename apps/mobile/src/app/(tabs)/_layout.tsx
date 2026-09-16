import { Tabs } from 'expo-router';
import React from 'react';

/**
 * The four tabs from SPEC.md 8.7: Passport, Games, Plan, Profile.
 *
 * The native tab bar is hidden because every ported screen draws the reference's own
 * <TabBar/> as part of its layout, and that bar is what navigates. Rendering both would
 * show two. Tabs is still used rather than a Stack so each tab keeps its own state.
 *
 * The legacy-* routes are the pre-redesign screens. They stay reachable so their deep
 * links (settings, delete account, imports) keep working until those move to the new
 * Profile screen, but they are not in the bar.
 */
export default function TabLayout() {
  return <Tabs screenOptions={{ headerShown: false }} tabBar={() => null} />;
}
