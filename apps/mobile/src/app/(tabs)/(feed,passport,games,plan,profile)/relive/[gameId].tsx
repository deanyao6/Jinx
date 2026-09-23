import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { Loading } from '@/components/Loading';
import { useGame } from '@/features/games/queries';
import { ReliveScreen } from '@/features/relive/reference/ReliveScreen';

/**
 * SPEC.md 6.19. Reached from a finished game that has detail ingested. Every sport, MLS included
 * since the next wave (E.4): its story comes from ESPN's summary on the state-model line.
 *
 * The gameId is the screen's whole input: it resolves the game, the user's attendance row,
 * the win probability timeline and the story steps. Before it was passed through, every
 * real user saw the empty state here no matter which game they opened.
 */
export default function ReliveRoute() {
  const { gameId, step } = useLocalSearchParams<{ gameId: string; step?: string }>();
  const game = useGame(gameId);
  // Development only: `jinx:///relive/<id>?step=12` opens on that step of the story, because
  // the simulator cannot be tapped by a script (STATE.md trap 9). The key remounts the player
  // when the link changes on a screen that is already open.
  const devStep = __DEV__ && step && /^\d+$/.test(step) ? Number(step) : 0;
  if (game.isPending) return <Loading label="Loading game" />;
  return <ReliveScreen key={devStep} gameId={gameId} step={devStep} />;
}
