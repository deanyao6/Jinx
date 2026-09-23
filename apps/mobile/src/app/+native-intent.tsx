import { systemPathToHref } from '@/features/navigation/tabs';

/**
 * Every URL the system opens the app with goes through here first. A path that belongs to a tab
 * gains that tab's group, so `jinx:///games/abc` opens on the Games stack with the Games list
 * under it and back reaches a tab root (features/navigation/tabs.ts). Paths are never renamed:
 * links in builds 4 and 5 keep working. Throwing here would crash the app, so it cannot.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return systemPathToHref(path);
  } catch {
    return path;
  }
}
