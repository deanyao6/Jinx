import { useMemo } from 'react';

import { useMyAttendanceForGame } from '@/features/attendances/queries';
import { reliveFromGame } from '@/features/data/supabase';
import type { ReliveFixture, ReliveStep } from '@/features/data/shapes';
import { useGame } from '@/features/games/queries';

import { useGameStorySteps, useGameWinProbability } from './queries';

/**
 * Relive for one real game (SPEC.md 6.19).
 *
 * The screen used to read `relive()` off the repository, which holds the signed-in user's
 * aggregate data and takes no game id, so every real user got the empty state no matter
 * which game they opened. This is the missing half: the route's gameId resolves the game,
 * the user's own attendance row, the win probability timeline and the story steps, and
 * `reliveFromGame` turns the first two into the scorebug and the note under it.
 *
 * Everything is a straight read. The story text is MLB's own play description, stored by
 * ingest/src/mlb/relive.ts — nothing here writes prose.
 */
export type ReliveGameData = {
  relive: ReliveFixture;
  steps: ReliveStep[];
  winProb: number[];
  /** True while any of the four reads is still in flight, so the screen can say "loading". */
  isPending: boolean;
};

/**
 * The three ticks under the win probability chart.
 *
 * The reference labels them "First pitch / 7th inning / Final". Those are baseball words,
 * so the middle one follows the sport rather than being hardcoded; the outer two are the
 * start and end of any game.
 */
export function chartLabelsForSport(sportId: string): ReliveFixture['chartLabels'] {
  return sportId === 'mlb'
    ? { left: 'First pitch', middle: '7th inning', right: 'Final' }
    : { left: 'Kickoff', middle: 'Halftime', right: 'Final' };
}

export function useReliveGame(gameId: string | undefined): ReliveGameData {
  const game = useGame(gameId);
  const attendance = useMyAttendanceForGame(gameId);
  const wp = useGameWinProbability(gameId);
  const steps = useGameStorySteps(gameId);

  const g = game.data;
  const a = attendance.data;

  const relive = useMemo((): ReliveFixture => {
    if (!g) return EMPTY_RELIVE;
    const { away, home, note } = reliveFromGame(g, {
      seat: a?.seat?.section ?? null,
      companions: (a?.companions ?? [])
        .map((c) => c.person?.display_name)
        .filter((n): n is string => !!n),
    });
    return {
      away,
      home,
      note,
      idleHint: 'Tap play to relive it',
      chartLabels: chartLabelsForSport(g.sport_id),
      // Fan photos have no backend yet, so the header shows no count rather than a zero
      // that would read as "nobody was there".
      fanCount: '',
    };
  }, [g, a]);

  return {
    relive,
    steps: steps.data ?? [],
    winProb: wp.data ?? [],
    isPending: game.isPending || wp.isPending || steps.isPending,
  };
}

/** Before the game read lands there is no scorebug to draw, only its shape. */
const EMPTY_RELIVE: ReliveFixture = {
  away: { team: 'none', badge: '—', name: '' },
  home: { team: 'none', badge: '—', name: '' },
  note: '',
  idleHint: 'Tap play to relive it',
  chartLabels: { left: '', middle: '', right: '' },
  fanCount: '',
};
