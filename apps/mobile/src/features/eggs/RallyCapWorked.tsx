import React from 'react';

import { useAuthStore } from '@/features/auth/store';
import { Fact } from '@/features/games/ui/detailParts';
import { env } from '@/lib/env';

import { eggs } from './flags';
import { rallyCapWorked } from './live';
import { useEggStore } from './store';

/**
 * One line on the game detail page, for a game where this person flipped their rally cap on this
 * device and the side they flipped it for went on to win. After a loss it says nothing at all.
 */
export function RallyCapWorked({
  gameId,
  winnerTeamId,
}: {
  gameId: string;
  /** The team that won, once the game is final. Null before that, and for a tie. */
  winnerTeamId: string | null;
}) {
  const userId = useAuthStore((state) => state.userId);
  const cap = useEggStore((state) => (userId ? state.rallyCaps[userId]?.[gameId] : undefined));
  if (!eggs.rallyCap || env.demo || !rallyCapWorked(cap, winnerTeamId)) return null;
  return <Fact icon="i-spark">Rally cap worked.</Fact>;
}
