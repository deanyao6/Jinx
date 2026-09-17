import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { alpha, luminance } from './color';
import { useOptionalReferenceTheme } from './reference/TeamTheme';
import { NEUTRAL_TEAM_KEY } from './reference/teams';
import { darkColors, makeTheme, type Accent, type Theme } from './tokens';

const SchemeContext = createContext<'light' | 'dark' | null>(null);

type Props = {
  children: React.ReactNode;
  /** Forces a scheme regardless of the system setting (share cards render both variants). */
  scheme?: 'light' | 'dark';
};

export function ThemeProvider({ children, scheme }: Props) {
  const system = useColorScheme();
  const resolved = scheme ?? (system === 'dark' ? 'dark' : 'light');
  return <SchemeContext.Provider value={resolved}>{children}</SchemeContext.Provider>;
}

/**
 * The theme, with the accent of whichever team is in scope where the caller renders.
 *
 * The accent is resolved here rather than stored in the provider because the team changes by
 * subtree (a game card inside a list is that game's team) while the scheme is set once at the
 * root, and the hook is the only place that sees both.
 */
export function useTheme(): Theme {
  const scheme = useContext(SchemeContext) ?? 'light';
  const team = useOptionalReferenceTheme();
  return useMemo(() => {
    if (!team || team.teamKey === NEUTRAL_TEAM_KEY) return makeTheme(scheme);
    const p = scheme === 'dark' ? team.tokens.dark : team.tokens.light;
    // A team fill is one value for both appearances, and a few are nearly black (the Bears'
    // navy, the Raiders). On a dark screen a button that colour cannot be seen, so there the
    // hand-tuned dark accent does the filling and the text on it goes dark.
    const lost = scheme === 'dark' && luminance(p.fill) < 0.035;
    const accent: Accent = {
      fill: lost ? p.accent : p.fill,
      onFill: lost ? darkColors.screen : p.onFill,
      text: p.accent,
      second: p.second,
      wash: alpha(p.accent, scheme === 'dark' ? 0.16 : 0.1),
      themed: true,
    };
    return makeTheme(scheme, accent);
  }, [scheme, team]);
}
