import React from 'react';

import { RoutePlaceholder } from '@/features/navigation/ui/RoutePlaceholder';

/** One team's season streak. A placeholder until prompt 4 computes streaks. */
export default function StreakRoute() {
  return (
    <RoutePlaceholder
      icon="i-trend"
      title="Streaks are coming"
      body="Every season in a row you have seen this team play, and your leanest one."
    />
  );
}
