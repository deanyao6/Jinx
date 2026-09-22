import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { Loading } from '@/components/Loading';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { useGame } from '@/features/games/queries';
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
  const game = useGame(gameId);
  if (game.isPending) return <Loading label="Loading game" />;
  if (game.data?.sport_id === 'mls') {
    return (
      <Screen>
        <Notice>
          Relive is not available for MLS yet. Schedules, results and attendance logging are
          available from the game page.
        </Notice>
      </Screen>
    );
  }
  return <ReliveScreen gameId={gameId} />;
}
