import React from 'react';

import {
  ReferenceThemeProvider,
  TeamTheme,
  useOptionalReferenceTheme,
} from '@/theme/reference/TeamTheme';

type Props = { team: string | null | undefined; children: React.ReactNode };

/**
 * Puts one side of a game in scope, so `useTheme().accent` underneath is that team.
 *
 * `TeamTheme` throws outside a provider, which is right in the app (AccentRoot is always above)
 * and wrong in a unit test that renders a screen bare. This takes the provider above when there
 * is one and starts one when there is not.
 *
 * With no team it keeps whatever was in scope, and it does so through the same element rather
 * than by returning its children bare: a screen that gains a team after mount (Log a season,
 * once a team is picked) must not remount everything underneath and lose its scroll position.
 */
export function SideTheme({ team, children }: Props) {
  const parent = useOptionalReferenceTheme();
  if (!parent) {
    return <ReferenceThemeProvider team={team ?? undefined}>{children}</ReferenceThemeProvider>;
  }
  return <TeamTheme team={team ?? parent.teamKey}>{children}</TeamTheme>;
}
