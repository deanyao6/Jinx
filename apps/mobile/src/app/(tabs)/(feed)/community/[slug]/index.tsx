import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { RoutePlaceholder } from '@/features/navigation/ui/RoutePlaceholder';

/** One community. A placeholder until prompt 4 builds it. */
export default function CommunityRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return (
    <RoutePlaceholder
      icon="i-flag"
      title="This community is coming"
      body="Its members, their posts and its leaderboards will open here."
      links={[{ label: 'Leaderboard', href: `/community/${slug}/leaderboard` }]}
    />
  );
}
