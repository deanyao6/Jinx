import { highlightsSiteLabel, officialHighlightsUrl, scoringNote } from '@jinx/core';
import { useMemo } from 'react';

import { useMyAttendanceForGame } from '@/features/attendances/queries';
import { reliveFromGame } from '@/features/data/supabase';
import type { ReliveFixture, ReliveStep } from '@/features/data/shapes';
import { useGame } from '@/features/games/queries';
import { useMyStats } from '@/features/passport/queries';
import { useCompanionRecords } from '@/features/people/queries';
import { shareGameFor } from '@/features/share/fromGame';
import type { ShareGame } from '@/features/share/types';

import { personalLine, withPersonalLine } from './personal';
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
  /** The user's own attendance row for this game; photos hang off it. Undefined if not logged. */
  attendanceId: string | undefined;
  /** The league's own page for this game, and the line that says where the link goes. */
  highlights: { url: string; meta: string };
  /** The share card for this game, told from the user's own side. Null until the game loads. */
  shareGame: ShareGame | null;
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

  const stats = useMyStats();
  const companions = useCompanionRecords();

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
      // Set by the screen from the fan photos it actually loaded.
      fanCount: '',
    };
  }, [g, a]);

  // SPEC 6.19: the final step carries a line from the user's own data, worked out when the
  // story is viewed and never stored with it.
  const personal = useMemo(() => {
    if (!g || !a) return null;
    const rooted = a.rooting_team_id;
    const decided = g.home_score != null && g.away_score != null && rooted;
    const mine = rooted === g.home_team_id ? g.home_score : g.away_score;
    const theirs = rooted === g.home_team_id ? g.away_score : g.home_score;
    const result = !decided
      ? null
      : (mine ?? 0) > (theirs ?? 0)
        ? ('win' as const)
        : (mine ?? 0) < (theirs ?? 0)
          ? ('loss' as const)
          : ('tie' as const);
    const tagged = new Set((a.companions ?? []).map((c) => c.person?.id).filter(Boolean));
    const together = (companions.data ?? []).find((c) => tagged.has(c.person_id));
    return personalLine({
      result,
      companion: together
        ? {
            name: together.display_name,
            wins: together.wins,
            losses: together.losses,
            ties: together.ties,
          }
        : null,
      overall: stats.data?.overall ?? null,
    });
  }, [g, a, companions.data, stats.data]);

  // Each scoring step gets its note, "Touchdown, A.J. Brown", by the same rule as the game
  // page's Scoring section: the touchdown scorer and the field goal kicker are named, an extra
  // point is not; in baseball it is the batter and the event.
  const sport = g?.sport_id;
  const storySteps = useMemo(
    () =>
      withPersonalLine(
        (steps.data ?? []).map((s) =>
          s.kind && sport
            ? {
                ...s,
                note: scoringNote({
                  sport,
                  kind: s.kind,
                  scorerName: s.scorerName ?? null,
                  description: s.text,
                  runs: s.runs ?? 0,
                }),
              }
            : s,
        ),
        personal,
      ),
    [steps.data, personal, sport],
  );

  const highlights = useMemo(
    () => ({
      url: officialHighlightsUrl({
        sport: g?.sport_id ?? 'mlb',
        providerGameId: g?.provider_game_id,
        season: g?.season,
        gameType: g?.game_type,
        // The stored nickname or nothing. A name derived from the city would build a URL that
        // 404s for the Giants and Jets, and the league hub is the better answer then.
        awayNickname: g?.away?.nickname ?? null,
        homeNickname: g?.home?.nickname ?? null,
      }),
      meta: highlightsSiteLabel(g?.sport_id ?? 'mlb'),
    }),
    [g],
  );

  return {
    relive,
    steps: storySteps,
    winProb: wp.data ?? [],
    attendanceId: a?.id,
    highlights,
    shareGame: g ? shareGameFor(g, a ?? null) : null,
    isPending: game.isPending || wp.isPending || steps.isPending,
  };
}

/** Before the game read lands there is no scorebug to draw, only its shape. */
const EMPTY_RELIVE: ReliveFixture = {
  away: { team: 'none', badge: '–', name: '' },
  home: { team: 'none', badge: '–', name: '' },
  note: '',
  idleHint: 'Tap play to relive it',
  chartLabels: { left: '', middle: '', right: '' },
  fanCount: '',
};
