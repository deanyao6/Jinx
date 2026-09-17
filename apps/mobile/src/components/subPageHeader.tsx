import type { Href } from 'expo-router';
import React, { createContext, useContext } from 'react';

import { LegacyBackButton } from '@/components/reference/BackHeader';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Whether the screen in scope sits under a navigator header.
 *
 * `Screen` pads its top by the status bar inset, which is right for a screen that draws to the
 * top edge and wrong under a header, where the navigator has already moved the content down:
 * every sub page opened with a band of nothing under its title. A layout that shows a header
 * says so here, and `Screen` stops adding the inset.
 */
const UnderHeaderContext = createContext(false);

export function UnderHeader({ children }: { children: React.ReactNode }) {
  return <UnderHeaderContext.Provider value>{children}</UnderHeaderContext.Provider>;
}

export function useIsUnderHeader(): boolean {
  return useContext(UnderHeaderContext);
}

/**
 * The header every sub page stack shares: the canvas colour with no rule under it, the title in
 * the Passport's condensed heavy capitals, and a back button that is always there.
 *
 * These screens are the first entry in their own nested stack whenever they are opened from a
 * tab, so the navigator draws no back button and the only way out was the edge swipe. An
 * explicit `headerLeft` is always visible, and `fallback` is where it goes when a deep link
 * opened the screen cold.
 */
export function useSubPageHeader(fallback: Href) {
  const theme = useTheme();
  return {
    headerShown: true,
    headerBackButtonDisplayMode: 'minimal',
    headerLeft: () => <LegacyBackButton fallback={fallback} />,
    headerTintColor: theme.colors.ink,
    headerStyle: { backgroundColor: theme.colors.screen },
    headerShadowVisible: false,
    headerTitleAlign: 'center',
    headerTitleStyle: {
      fontFamily: fontFamily({ width: 62, weight: 900 }),
      fontSize: 21,
      color: theme.colors.ink,
    },
    contentStyle: { backgroundColor: theme.colors.screen },
  } as const;
}
