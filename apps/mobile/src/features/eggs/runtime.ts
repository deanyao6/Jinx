import * as Haptics from 'expo-haptics';
import React from 'react';
import { AppState } from 'react-native';

import { useMyAttendances, type Attendance } from '@/features/attendances/queries';
import { useRepositoryState } from '@/features/data/context';
import { demoRepository } from '@/features/data/demo';
import { env } from '@/lib/env';

import type { ReplayGame } from './rewind';

/**
 * Whether eggs may run at all here.
 *
 * Never in demo mode: `npm run parity` compares the Passport with the reference pixel by pixel,
 * and the fixture account has no games, no check-in and no user to remember anything for. Demo
 * mode is the build flag, the repository's status, or the demo repository itself, whichever a
 * screen was given (a test hands the fixtures over with no flag set).
 */
export function useEggsLive(): boolean {
  const { repository, status } = useRepositoryState();
  return !env.demo && status !== 'demo' && repository !== demoRepository;
}

/** One light tap. Never throws: a binary without the module, or a simulator, just stays quiet. */
export function lightHaptic(): void {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {
    // No haptics here. The egg is the picture, not the tap.
  }
}

export function toReplayGame(a: Attendance): ReplayGame {
  return {
    gameId: a.game.id,
    scheduledStart: a.game.scheduled_start,
    status: a.game.status,
    homeTeamId: a.game.home_team_id,
    awayTeamId: a.game.away_team_id,
    homeScore: a.game.home_score,
    awayScore: a.game.away_score,
    rootingTeamId: a.rooting_team_id,
    homeAbbreviation: a.game.home?.abbreviation ?? null,
    awayAbbreviation: a.game.away?.abbreviation ?? null,
  };
}

/**
 * The person's attended games, from the very query the record game log and the Games tab read
 * (`useMyAttendances`). Same key, so this is a second reader of one cache entry and not a second
 * request.
 */
export function useAttendedGames(): readonly ReplayGame[] {
  const attendances = useMyAttendances();
  return React.useMemo(
    () => (attendances.data ?? []).filter((a) => a.status === 'attended').map(toReplayGame),
    [attendances.data],
  );
}

// One clock for every reader, moved on by events rather than by a timer.
let clock = Date.now();
const clockReaders = new Set<() => void>();
let clockSubscription: { remove: () => void } | null = null;

function moveClock(): void {
  clock = Date.now();
  clockReaders.forEach((reader) => reader());
}

function readClock(onChange: () => void): () => void {
  clockReaders.add(onChange);
  clockSubscription ??= AppState.addEventListener('change', (state) => {
    if (state === 'active') moveClock();
  });
  return () => {
    clockReaders.delete(onChange);
    if (clockReaders.size === 0) {
      clockSubscription?.remove();
      clockSubscription = null;
    }
  };
}

/**
 * The time, for rules whose windows are hours wide. The tabs stay mounted for as long as the app
 * runs, so a time read once at mount goes stale; this one moves on whenever the app comes to the
 * front and whenever `dep` changes (checking in changes the attendances, for one). No timer runs.
 */
export function useNow(dep?: unknown): number {
  React.useEffect(() => {
    moveClock();
  }, [dep]);
  return React.useSyncExternalStore(readClock, () => clock);
}
