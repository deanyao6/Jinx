import React from 'react';

import { RoutePlaceholder } from '@/features/navigation/ui/RoutePlaceholder';

/**
 * A community's leaderboard, `?stat=&period=` once prompt 4 builds it. Only verified
 * attendance will rank.
 */
export default function LeaderboardRoute() {
  return (
    <RoutePlaceholder
      icon="i-trend"
      title="Leaderboards are coming"
      body="Members ranked by verified games, wins and more, by season or all time."
    />
  );
}
