import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { makeTheme, type Theme } from './tokens';

const ThemeContext = createContext<Theme>(makeTheme('light'));

type Props = {
  children: React.ReactNode;
  /** Forces a scheme regardless of the system setting (share cards render both variants). */
  scheme?: 'light' | 'dark';
};

export function ThemeProvider({ children, scheme }: Props) {
  const system = useColorScheme();
  const resolved = scheme ?? (system === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => makeTheme(resolved), [resolved]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
