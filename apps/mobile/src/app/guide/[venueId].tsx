import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { StadiumGuideScreen } from '@/features/guide/reference/StadiumGuideScreen';

/**
 * SPEC.md 8.8 item 6. A demo shell in v1, reached from a venue or a game.
 *
 * The guide's content is demo data behind the shell, but the venue is real: the id is passed
 * through so the share card is the user's own stamp for this stadium, with their real visit
 * count and first visit, rather than a made-up one.
 */
export default function StadiumGuideRoute() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  return <StadiumGuideScreen venueId={venueId} />;
}
