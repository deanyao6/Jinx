import { useEffect, useRef } from 'react';

import { useGameContext, useLiveState } from '@/features/checkin/queries';
import { hasLiveFeed } from '@/features/eggs/live';

import { engineStep, initialEngineState, PHONE_SPORTS, type EngineState } from './engine';
import { reportLiveMoment } from './queries';

/**
 * Runs the phone-side engine for my open session: polls the feed (the same `useLiveState` the
 * game page uses, every 30 s) and reports what the rules let through. Only while the session
 * is open and the app is in the foreground; when the phone is in a pocket the other phones
 * there, or the server for MLB, carry it, and a session with nothing fired ends in the one
 * post-game prompt (03, section 1, offline).
 */
export function useReactionEngine(gameId: string | null | undefined, enabled: boolean): void {
  const ctx = useGameContext(gameId ?? undefined);
  const sport = ctx.data?.sport_id ?? null;
  const phoneSport = !!sport && PHONE_SPORTS.has(sport);
  const live = useLiveState(gameId ?? undefined, sport, enabled && phoneSport && hasLiveFeed(sport) && ctx.data?.status !== 'final');
  const state = useRef<EngineState>(initialEngineState());
  const lastFetched = useRef<string | null>(null);

  useEffect(() => {
    state.current = initialEngineState();
    lastFetched.current = null;
  }, [gameId]);

  useEffect(() => {
    const row = live.data;
    const c = ctx.data;
    if (!enabled || !row || !c || !gameId || !phoneSport) return;
    if (lastFetched.current === row.fetched_at) return;
    lastFetched.current = row.fetched_at;
    const { reports, next } = engineStep(state.current, row, {
      gameId,
      sport: c.sport_id,
      homeName: c.home.name,
      awayName: c.away.name,
      homePrior: c.home.win_prob ?? null,
    });
    state.current = next;
    for (const r of reports) {
      reportLiveMoment(r).catch(() => {
        // The next poll tries again; the server dedupes by event key.
        if (r.eventKey) state.current.reported.delete(r.eventKey);
        if (r.kind === 'checkin') state.current.scheduledReported = false;
      });
    }
  }, [live.data, ctx.data, enabled, gameId, phoneSport]);
}
