import { createContext, useContext } from 'react';

/**
 * True inside the five-tab navigator (`app/(tabs)/_layout.tsx`), which draws one tab bar under
 * every screen in every tab. The reference screens still render `<TabBar/>` as the reference
 * does, and it steps aside here; outside the navigator (the parity harness) it draws, so a
 * parity shot still has its bar. `Screen` reads it too: the bar already clears the home
 * indicator, so a screen above it does not pad for it a second time.
 */
export const InTabNavigator = createContext(false);

export function useInTabNavigator(): boolean {
  return useContext(InTabNavigator);
}
