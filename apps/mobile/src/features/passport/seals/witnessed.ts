import { gameResult } from '@jinx/core';

import type { WitnessedGame } from '@/features/eggs/stamps';

/**
 * One row of the rare-games query (./queries), and how it becomes what the golden rule reads.
 * Apart from the query so it can be tested without the Supabase client.
 */
export type RareRow = {
  rooting_team_id: string | null;
  game: {
    id: string;
    sport_id: string;
    venue_id: string | null;
    status: string;
    home_team_id: string;
    away_team_id: string;
    home_score: number | null;
    away_score: number | null;
    winner_team_id?: string | null;
    events: { type: string }[];
  };
};

/** One attended game and its rare events, as the golden rule wants it. */
export function toWitnessedGame(row: RareRow): WitnessedGame {
  const g = row.game;
  return {
    sport: g.sport_id,
    venueId: g.venue_id,
    eventTypes: g.events.map((e) => e.type),
    // Null without a rooting side, which is what keeps an overtime game watched as a neutral
    // from counting as "an overtime win".
    result: gameResult(
      {
        status: g.status as 'final',
        homeTeamId: g.home_team_id,
        awayTeamId: g.away_team_id,
        homeScore: g.home_score,
        awayScore: g.away_score,
        winnerTeamId: g.winner_team_id,
      } as Parameters<typeof gameResult>[0],
      row.rooting_team_id,
    ),
  };
}
