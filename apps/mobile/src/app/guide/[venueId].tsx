import React from 'react';

import { StadiumGuideScreen } from '@/features/guide/reference/StadiumGuideScreen';

/**
 * SPEC.md 8.8 item 6. A demo shell in v1, reached from a venue or a game.
 *
 * Same as Relive: the route carries venueId so links are right, while the screen still
 * renders the demo guide until the repository takes an id.
 */
export default function StadiumGuideRoute() {
  return <StadiumGuideScreen />;
}
