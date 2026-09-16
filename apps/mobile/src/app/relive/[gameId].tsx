import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { ReliveScreen } from '@/features/relive/reference/ReliveScreen';

/**
 * SPEC.md 6.19. Reached from a finished game that has detail ingested.
 *
 * The gameId is the screen's whole input: it resolves the game, the user's attendance row,
 * the win probability timeline and the story steps. Before it was passed through, every
 * real user saw the empty state here no matter which game they opened.
 */
export default function ReliveRoute() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  return <ReliveScreen gameId={gameId} />;
}
