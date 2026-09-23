import { Stack, type Href } from 'expo-router';
import React from 'react';

import { LegacyBackButton } from '@/components/reference/BackHeader';
import { UnderHeader, useSubPageHeader } from '@/components/subPageHeader';

/**
 * The stack every tab owns. This one file is five layouts: expo-router expands the group list
 * into `(feed)`, `(passport)`, `(games)`, `(plan)` and `(profile)`, each a separate stack, and
 * the routes in this folder exist in all five, so a game or a profile opens on whichever tab it
 * was tapped from.
 *
 * Each tab anchors on its root, so a deep link straight to `/games/abc` still has the Games list
 * under it and back never dead ends. Four roots share their group's name and are found by that;
 * the Passport's root is `index`, so it is named.
 *
 * The screens used to sit in folder stacks of their own (`games/_layout.tsx` and the rest), and
 * their titles and presentations moved here unchanged. A screen that draws its own header is
 * listed in `OWN_HEADER`; every other one gets the shared sub page header.
 */
export const unstable_settings = {
  feed: { initialRouteName: 'feed' },
  passport: { initialRouteName: 'index' },
  games: { initialRouteName: 'games' },
  plan: { initialRouteName: 'plan' },
  profile: { initialRouteName: 'profile' },
};

/** Tab roots and screens that draw their own top: no navigator header. */
const OWN_HEADER = new Set([
  'feed',
  'index',
  'games',
  'plan',
  'profile',
  'legacy-passport',
  'legacy-games',
  'legacy-you',
  'legacy-friends',
  'relive/[gameId]',
  'guide/[venueId]',
  'settings/index',
  'settings/favorites/index',
  'settings/favorites/league',
  'settings/favorites/players',
  'settings/favorites/roster',
  'settings/favorites/teams',
]);

type ScreenOptions = { title: string; presentation?: 'modal' };

const SCREENS: Record<string, ScreenOptions> = {
  // Games
  'games/search': { title: 'Find a game' },
  'games/[gameId]': { title: 'Game' },
  'games/log/[gameId]': { title: 'Log game', presentation: 'modal' },
  'games/bulk': { title: 'Log a season' },
  'games/checkin/[gameId]': { title: 'Check in' },
  'games/imports': { title: 'Imports' },
  'games/import': { title: 'Upload tickets' },
  // Passport
  'passport/stamps': { title: 'Stamps' },
  'passport/superlatives': { title: 'Superlatives' },
  'passport/famous': { title: 'Famous games' },
  'passport/moments': { title: 'Moments' },
  'passport/moment/[type]': { title: 'Moment' },
  'passport/players': { title: 'Players seen' },
  'passport/player/[id]': { title: 'Player' },
  'passport/map': { title: 'Map' },
  'passport/goals': { title: 'Goals' },
  'passport/new-goal': { title: 'New goal', presentation: 'modal' },
  'passport/bucketlists': { title: 'Bucket lists' },
  'passport/bucketlist/[id]': { title: 'Bucket list' },
  'passport/new-bucketlist': { title: 'New bucket list', presentation: 'modal' },
  'passport/badges': { title: 'Badges' },
  'passport/favorites': { title: 'Four favorites' },
  'passport/streak/[teamId]': { title: 'Streak' },
  // Feed
  'post/[postId]/index': { title: 'Post' },
  'post/[postId]/comments': { title: 'Comments' },
  communities: { title: 'Communities' },
  'community/[slug]/index': { title: 'Community' },
  'community/[slug]/leaderboard': { title: 'Leaderboard' },
  'u/[handle]': { title: 'Profile' },
  // Profile
  'friends/find': { title: 'Find people' },
  'friends/requests': { title: 'Follow requests' },
  'friends/person/[id]': { title: 'Companion' },
  'you/edit-profile': { title: 'Edit profile' },
  'you/privacy': { title: 'Privacy' },
  'you/forwarding': { title: 'Forwarding address' },
  'you/notifications': { title: 'Notifications' },
  'you/notification-settings': { title: 'Notification settings' },
  'you/blocked': { title: 'Blocked users' },
  'you/about': { title: 'About' },
  'you/terms': { title: 'Terms of use' },
  'you/privacy-policy': { title: 'Privacy policy' },
  'you/delete-account': { title: 'Delete account' },
  // Development only: linked from About when __DEV__, an empty page otherwise.
  'you/eggs': { title: 'Easter eggs' },
};

/** Where a sub page's back button goes when a cold deep link left nothing under it. */
function fallbackFor(name: string): Href {
  if (name.startsWith('games/') || name.startsWith('relive/')) return '/games';
  if (name.startsWith('you/')) return '/settings';
  if (name.startsWith('friends/')) return '/profile';
  if (/^(u|post|community|communities)\b/.test(name)) return '/feed';
  return '/';
}

function useScreenOptions() {
  const header = useSubPageHeader('/');
  return ({ route }: { route: { name: string } }) => {
    if (OWN_HEADER.has(route.name)) return { headerShown: false };
    const screen = SCREENS[route.name];
    return {
      ...header,
      headerLeft: () => <LegacyBackButton fallback={fallbackFor(route.name)} />,
      title: screen?.title ?? '',
      ...(screen?.presentation ? { presentation: screen.presentation } : null),
    };
  };
}

export default function TabStackLayout() {
  const screenOptions = useScreenOptions();
  return (
    <Stack
      screenOptions={screenOptions}
      // `Screen` pads by the status bar unless a header already moved it down (subPageHeader.tsx).
      screenLayout={({ route, children }) =>
        OWN_HEADER.has(route.name) ? children : <UnderHeader>{children}</UnderHeader>
      }
    />
  );
}
