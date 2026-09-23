// Every screen needs a way in.
//
// When the reference tab bar replaced the old tabs, everything that only the old tabs linked to
// became unreachable without anything failing: sign out, export my data, moments witnessed,
// bucket lists and follow requests. A user found the first; an audit found the rest. This test
// is that audit, kept: each route under src/app must be named by some other file that is itself
// still reachable, or be listed below with the reason it needs no link.
//
// Same shape as games/__tests__/copy.test.ts: the mobile tsconfig carries no node types.
declare const __dirname: string;
declare function require(id: string): unknown;

type Dirent = { name: string; isDirectory(): boolean };
const { readFileSync, readdirSync } = require('node:fs') as {
  readFileSync: (p: string, enc: string) => string;
  readdirSync: (p: string, opts: { withFileTypes: true }) => Dirent[];
};
const { join, relative, sep } = require('node:path') as {
  join: (...parts: string[]) => string;
  relative: (from: string, to: string) => string;
  sep: string;
};

// Kept out of src/app on purpose: expo-router treats every file in there as a route.
const SRC = join(__dirname, '..', '..', '..');
const APP = join(SRC, 'app');

/** Routes nothing links to, on purpose. Anything added here needs its reason. */
const NO_LINK_NEEDED: Record<string, string> = {
  '/': 'the Passport tab, where the app opens',
  '/welcome': 'where the root layout sends a signed-out user',
  '/onboarding': 'where the root layout sends a new user',
  '/invite/[token]': 'opened by an invite deep link, jinx://invite/<token>',
  // The pre-redesign tabs. Deliberately orphaned: they stay only so nothing that still deep
  // links to them 404s. Whatever they alone offered must have a home elsewhere, which is what
  // the rest of this test enforces. Delete them once /legacy-games?segment=log is replaced.
  '/legacy-you': 'superseded by /settings',
  '/legacy-passport': 'superseded by the reference Passport',
  '/legacy-friends': 'superseded by the Friends panel on Profile',
  // Social v2 routes whose way in arrives with a later prompt (docs/prompts/social/). Each
  // resolves now so a push or share link sent early does not 404; remove the entry when the
  // feature that links to it lands.
  '/post/[postId]': 'opened by push and share links; prompt 2 links it from feed cards',
  '/community/[slug]': 'prompt 4 lists communities; until then only a link names one',
  '/passport/streak/[teamId]': 'prompt 4 puts the streak patch on the Passport',
  '/react/[gameId]': 'opened by the reaction prompt push, which prompt 3 sends',
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') out.push(...walk(path));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

/** `(tabs)/games.tsx` -> `/games`, `games/[gameId].tsx` -> `/games/[gameId]`, `x/index.tsx` -> `/x`. */
function routeOf(file: string): string | null {
  const rel = relative(APP, file).split(sep).join('/');
  if (/(^|\/)_layout\.tsx$/.test(rel) || rel.startsWith('+')) return null;
  const parts = rel
    .replace(/\.tsx?$/, '')
    .split('/')
    .filter((p) => !/^\(.*\)$/.test(p));
  if (parts[parts.length - 1] === 'index') parts.pop();
  // Group folders vanish from the URL. Two groups have an index: (tabs) is `/`, and the
  // onboarding one is only ever addressed with its group, so it is named by it here.
  const path = `/${parts.join('/')}`;
  if (rel.startsWith('(onboarding)/') && path === '/') return '/onboarding';
  return path;
}

/** A literal that would navigate to `route`: exact, with a query, or a template for its params. */
function linkPattern(route: string): RegExp {
  const escaped = route
    .split('/')
    .map((segment) =>
      /^\[.*\]$/.test(segment)
        ? '(?:\\$\\{[^}]+\\}|\\[[^\\]]+\\])'
        : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('/');
  // Optional route-group prefix such as /(tabs) or /(auth), then the path, then a terminator.
  return new RegExp(`['"\`](?:/\\([a-z-]+\\))?${escaped}(?:[?#][^'"\`]*)?['"\`]`);
}

describe('every route has a way in', () => {
  const routeFiles = walk(APP);
  const routes = routeFiles
    .map((file) => ({ file, route: routeOf(file) }))
    .filter((r): r is { file: string; route: string } => r.route !== null);
  const sources = walk(SRC).map((file) => ({ file, text: readFileSync(file, 'utf8') }));
  const orphanedFiles = new Set(
    routes.filter((r) => r.route.startsWith('/legacy-')).map((r) => r.file),
  );

  it('finds the routes', () => {
    expect(routes.length).toBeGreaterThan(50);
    expect(routes.map((r) => r.route)).toEqual(
      expect.arrayContaining(['/settings', '/games/[gameId]', '/passport/moments', '/profile']),
    );
  });

  for (const { file, route } of routes) {
    if (route in NO_LINK_NEEDED) continue;
    it(`${route} is linked from somewhere reachable`, () => {
      const pattern = linkPattern(route);
      const linkers = sources.filter(
        (s) => s.file !== file && !orphanedFiles.has(s.file) && pattern.test(s.text),
      );
      expect({ route, linkedFrom: linkers.length > 0 }).toEqual({ route, linkedFrom: true });
    });
  }

  it('the allowlist names only routes that exist', () => {
    const known = new Set(routes.map((r) => r.route));
    expect(Object.keys(NO_LINK_NEEDED).filter((r) => !known.has(r))).toEqual([]);
  });
});

describe('actions that once had no entry point', () => {
  const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

  it('Settings offers sign out and data export', () => {
    const settings = read('app/(tabs)/(profile)/settings/index.tsx');
    expect(settings).toContain('useSignOut');
    expect(settings).toContain('useExportData');
  });
});
