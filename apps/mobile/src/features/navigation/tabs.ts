/**
 * The five tabs and which of them owns each route (docs/prompts/social/01, section 1).
 *
 * Every tab is its own stack under `app/(tabs)/(<tab>)`. A route in exactly one tab's folder is
 * owned by it: opening it from another tab switches tabs. A route in the shared folder,
 * `app/(tabs)/(feed,passport,games,plan,profile)`, exists in all five stacks, and expo-router
 * pushes it onto whichever tab is showing (its route sorter prefers the current group), so a
 * game opened from the Passport comes back to the Passport.
 *
 * Paths never change: `/games/<id>` is the same URL it was in build 4, only the stack it lands
 * on is new. What the URL alone cannot say is which tab a shared route belongs to when nothing
 * is showing yet, a cold deep link, so `ownedHref` spells the group out for those.
 */

export type TabKey = 'feed' | 'passport' | 'games' | 'plan' | 'profile';

export const TAB_ORDER: readonly TabKey[] = ['feed', 'passport', 'games', 'plan', 'profile'];

export const TAB_LABEL: Record<TabKey, string> = {
  feed: 'Feed',
  passport: 'Passport',
  games: 'Games',
  plan: 'Plan',
  profile: 'Profile',
};

/** Each tab's root, as a URL. The Passport stays at `/`, where the app has always opened. */
export const TAB_ROOT: Record<TabKey, string> = {
  feed: '/feed',
  passport: '/',
  games: '/games',
  plan: '/plan',
  profile: '/profile',
};

/** The route name of each tab's root inside its stack, which is also its anchor. */
export const TAB_ROOT_SCREEN: Record<TabKey, string> = {
  feed: 'feed',
  passport: 'index',
  games: 'games',
  plan: 'plan',
  profile: 'profile',
};

/** Routes outside the tabs: modals over everything, and the signed-out and invite flows. */
const OUTSIDE_TABS = ['wrapped', 'share', 'invite', 'react', 'welcome', 'email', 'code', 'parity'];

/**
 * First path segment to owning tab. A segment not listed belongs to no tab: the path is left
 * alone, and if it names no route, `app/+not-found.tsx` sends it to the Passport with a toast.
 */
const OWNER_BY_SEGMENT: Record<string, TabKey> = {
  feed: 'feed',
  post: 'feed',
  communities: 'feed',
  community: 'feed',
  u: 'feed',
  passport: 'passport',
  'legacy-passport': 'passport',
  games: 'games',
  'legacy-games': 'games',
  relive: 'games',
  guide: 'games',
  plan: 'plan',
  profile: 'profile',
  settings: 'profile',
  you: 'profile',
  friends: 'profile',
  'legacy-you': 'profile',
  'legacy-friends': 'profile',
};

function splitHref(href: string): { path: string; rest: string } {
  const cut = href.search(/[?#]/);
  return cut < 0 ? { path: href, rest: '' } : { path: href.slice(0, cut), rest: href.slice(cut) };
}

function segmentsOf(path: string): string[] {
  return path.split('/').filter((p) => p.length > 0 && !/^\(.*\)$/.test(p));
}

/** The tab a path belongs to, or null for a route outside the tabs or a path it does not know. */
export function ownerTab(href: string): TabKey | null {
  const [first] = segmentsOf(splitHref(href).path);
  if (first == null) return 'passport';
  if (OUTSIDE_TABS.includes(first)) return null;
  return OWNER_BY_SEGMENT[first] ?? null;
}

/**
 * The same href with its owning tab's group spelled out, so it lands on that tab's stack with the
 * tab root under it: `/games/abc` becomes `/(tabs)/(games)/games/abc`. An href that already names
 * a group, or belongs outside the tabs, or is not an app path, comes back unchanged.
 */
export function ownedHref(href: string): string {
  if (!href.startsWith('/') || href.startsWith('/(')) return href;
  const tab = ownerTab(href);
  if (tab == null) return href;
  const { path, rest } = splitHref(href);
  const clean = `/${segmentsOf(path).join('/')}`;
  return `/(tabs)/(${tab})${clean === '/' ? '' : clean}${rest}`;
}

/**
 * A URL the system hands the app (a tapped share link, `xcrun simctl openurl`), rewritten so a
 * shared route opens on its owning tab with the root under it. Only the app's own scheme and
 * bare paths are touched; anything else, the development client's URLs included, passes
 * through as it came.
 */
export function systemPathToHref(path: string): string {
  let rest = path;
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(path);
  if (scheme) {
    if (scheme[1]!.toLowerCase() !== 'jinx') return path;
    // `jinx:///games/x` has an empty host; `jinx://games/x` puts the first segment in the host.
    rest = `/${path.slice(scheme[0].length).replace(/^\/+/, '')}`;
  }
  if (!rest.startsWith('/')) return path;
  return ownedHref(rest);
}
