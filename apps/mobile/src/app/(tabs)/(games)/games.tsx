import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import { PostBanner } from '@/features/feed/ui/YourPost';
import { GamesScreen, SEGMENTS } from '@/features/games/reference/GamesScreen';

/**
 * The Games tab root. `?segment=upcoming|history|imports` picks the segment, and choosing one
 * rewrites the param in place (`setParams`), which never pushes: there is no back step between
 * segments. History stays the default, as it was. The banner is the posts waiting on me: a
 * draft in its edit window, or a recent game with "Post this" (social brief 02, section 1).
 */
export default function GamesTab() {
  const router = useRouter();
  const { segment } = useLocalSearchParams<{ segment?: string }>();
  const current = SEGMENTS.find((s) => s.toLowerCase() === segment?.toLowerCase()) ?? 'History';
  return (
    <GamesScreen
      segment={current}
      onSegment={(next) => router.setParams({ segment: next.toLowerCase() })}
      banner={<PostBanner />}
    />
  );
}
