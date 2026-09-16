import React from 'react';

import { ReliveScreen } from '@/features/relive/reference/ReliveScreen';

/**
 * SPEC.md 6.19. Reached from a finished game that has detail ingested.
 *
 * The route takes a gameId so links and deep links are already correct, but the screen
 * still renders the demo fixture: `relive()` on the repository does not take an id yet
 * (see docs/interactions.md). Passing it through is the next step, not a rename.
 */
export default function ReliveRoute() {
  return <ReliveScreen />;
}
