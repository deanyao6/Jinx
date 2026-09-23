import { CommonActions } from '@react-navigation/native';
import { Tabs } from 'expo-router';
import React from 'react';

import { InTabNavigator } from '@/features/navigation/context';
import { TAB_ORDER, type TabKey } from '@/features/navigation/tabs';
import { TabBarView } from '@/features/passport/reference/parts';

/**
 * The five tabs: Feed, Passport, Games, Plan, Profile (docs/prompts/social/01, section 1).
 *
 * Each tab is a stack of its own (`(tabs)/(feed,passport,games,plan,profile)/_layout.tsx`), so
 * switching tabs keeps every tab where it was, and tapping the tab that is already showing
 * pops its stack to the root: the tab press is emitted the way React Navigation's own bar
 * emits it, and a stack listens for it and pops.
 *
 * One bar for the whole app, drawn here. The reference screens also render `<TabBar/>`, which
 * stands down inside this navigator (`InTabNavigator`) and only draws for the parity harness.
 */
type BarProps = {
  state: { index: number; key: string; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: 'tabPress' | 'tabLongPress'; target: string; canPreventDefault?: boolean }) => {
      defaultPrevented?: boolean;
    };
    dispatch: (action: ReturnType<typeof CommonActions.navigate> & { target?: string }) => void;
  };
};

const groupOf = (tab: TabKey) => `(${tab})`;

function GlobalTabBar({ state, navigation }: BarProps) {
  const focused = state.routes[state.index]?.name;
  const active = TAB_ORDER.find((t) => groupOf(t) === focused) ?? null;
  const routeOf = (tab: TabKey) => state.routes.find((r) => r.name === groupOf(tab));
  return (
    <TabBarView
      active={active}
      onPress={(tab) => {
        const route = routeOf(tab);
        if (!route) return;
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (tab !== active && !event.defaultPrevented) {
          navigation.dispatch({ ...CommonActions.navigate(route.name), target: state.key });
        }
      }}
      onLongPress={(tab) => {
        const route = routeOf(tab);
        if (route) navigation.emit({ type: 'tabLongPress', target: route.key });
      }}
    />
  );
}

export default function TabLayout() {
  return (
    <InTabNavigator.Provider value>
      <Tabs
        initialRouteName="(passport)"
        // Every tab's stack exists from launch, root first. A lazy tab has no stack until it is
        // shown, and a push into it from another tab (settings from the Feed) would then start
        // the stack at that screen, with no root under it for back to reach.
        screenOptions={{ headerShown: false, lazy: false }}
        tabBar={(props) => <GlobalTabBar {...(props as unknown as BarProps)} />}
      >
        {TAB_ORDER.map((tab) => (
          <Tabs.Screen key={tab} name={groupOf(tab)} />
        ))}
      </Tabs>
    </InTabNavigator.Provider>
  );
}
