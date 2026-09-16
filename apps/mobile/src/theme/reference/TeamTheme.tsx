import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { darkBase, lightBase, type BaseColors } from './tokens';
import { NEUTRAL_TEAM_KEY, referenceTeam, type TeamPalette, type TeamTokens } from './teams';

/**
 * The native equivalent of the reference's `.t-*` classes (SPEC.md 8.2).
 *
 * In the CSS, putting `.t-phi` on an element redefines `--tf`, `--t`, `--t2` and `--on`
 * for that element and everything inside it, and a nested `.t-*` overrides it again.
 * React context has exactly those semantics, so any subtree can take on a team the same
 * way, and a component reads the team in scope without being told which one it is in.
 *
 * The theme (light or dark) is resolved here rather than at each call site, so a
 * component asks for `team.accent` and gets the right value for the current appearance.
 */

export type ReferenceTheme = {
  /** Resolved for the current colour scheme. */
  base: BaseColors;
  /** Resolved for the current colour scheme, from the team in scope. */
  team: TeamPalette;
  /** The key of the team in scope, e.g. 'phi'. 'none' is the neutral theme. */
  teamKey: string;
  scheme: 'light' | 'dark';
};

function resolve(tokens: TeamTokens, scheme: 'light' | 'dark'): TeamPalette {
  return scheme === 'dark' ? tokens.dark : tokens.light;
}

const ReferenceThemeContext = createContext<ReferenceTheme | null>(null);

/**
 * Palettes loaded from the `team_colors` table, keyed by team id.
 *
 * Supplied by TeamPaletteProvider near the root once the query resolves. Until then, and
 * in demo mode where there is no backend at all, lookups fall through to the 14 static
 * palettes and finally to the neutral theme. A team is therefore never un-themed: it is
 * either its own colours or a deliberate grey, never undefined.
 */
const TeamPaletteContext = createContext<ReadonlyMap<string, TeamTokens> | null>(null);

export function TeamPaletteProvider({
  palettes,
  children,
}: {
  palettes: ReadonlyMap<string, TeamTokens> | null | undefined;
  children: React.ReactNode;
}) {
  return (
    <TeamPaletteContext.Provider value={palettes ?? null}>{children}</TeamPaletteContext.Provider>
  );
}

/**
 * Resolve a team key to its palette.
 *
 * The key is a team id in the real app and one of the reference's short keys ('phi',
 * 'none') in demo mode, so both are tried. Loaded palettes win, because they are the full
 * hand-tuned set and the static ones are only a fallback; a test pins the 13 that appear
 * in both so they cannot disagree.
 */
function lookup(loaded: ReadonlyMap<string, TeamTokens> | null, key: string): TeamTokens {
  return loaded?.get(key) ?? referenceTeam(key);
}

/**
 * Root provider. Wrap once, near the top of a screen.
 *
 * `scheme` is normally the system appearance; pass it explicitly only where the design
 * pins a region to one theme regardless, as the record hero does.
 */
export function ReferenceThemeProvider({
  team = NEUTRAL_TEAM_KEY,
  scheme,
  children,
}: {
  team?: string;
  scheme?: 'light' | 'dark';
  children: React.ReactNode;
}) {
  const system = useColorScheme();
  const loaded = useContext(TeamPaletteContext);
  const resolved: 'light' | 'dark' = scheme ?? (system === 'dark' ? 'dark' : 'light');

  const value = useMemo<ReferenceTheme>(
    () => ({
      base: resolved === 'dark' ? darkBase : lightBase,
      team: resolve(lookup(loaded, team), resolved),
      teamKey: team,
      scheme: resolved,
    }),
    [team, resolved, loaded],
  );

  return <ReferenceThemeContext.Provider value={value}>{children}</ReferenceThemeContext.Provider>;
}

/**
 * Re-themes a subtree to another team, the way a nested `.t-*` class does. Inherits the
 * colour scheme from above, so only the team changes.
 */
export function TeamTheme({ team, children }: { team: string; children: React.ReactNode }) {
  const parent = useReferenceTheme();
  const loaded = useContext(TeamPaletteContext);
  const value = useMemo<ReferenceTheme>(
    () => ({
      ...parent,
      team: resolve(lookup(loaded, team), parent.scheme),
      teamKey: team,
    }),
    [parent, team, loaded],
  );
  return <ReferenceThemeContext.Provider value={value}>{children}</ReferenceThemeContext.Provider>;
}

export function useReferenceTheme(): ReferenceTheme {
  const ctx = useContext(ReferenceThemeContext);
  if (!ctx) {
    throw new Error(
      'useReferenceTheme must be used inside <ReferenceThemeProvider>. Wrap the screen, ' +
        'the way the reference puts a .t-* class on .scr.',
    );
  }
  return ctx;
}
