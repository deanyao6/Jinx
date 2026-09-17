import React from 'react';

import { useFavoriteTeams } from '@/features/profile/queries';
import { ReferenceThemeProvider } from '@/theme/reference/TeamTheme';

/**
 * Puts the person's own team in scope for the whole app, so every screen outside the reference
 * has a colour to lean on: their settings, goals and lists are in their team's colours. A screen
 * about one game or one team nests a `TeamTheme` and takes that side's colours instead, and the
 * reference screens mount their own provider, which wins over this one.
 *
 * The first favourite is the one used. Signed out, or with no favourites, it is the neutral
 * theme, which is ink.
 */
export function AccentRoot({ children }: { children: React.ReactNode }) {
  const favorites = useFavoriteTeams();
  const team = favorites.data?.[0]?.id;
  return <ReferenceThemeProvider team={team}>{children}</ReferenceThemeProvider>;
}
