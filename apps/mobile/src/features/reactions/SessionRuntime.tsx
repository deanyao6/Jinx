import React, { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useMyAttendances } from '@/features/attendances/queries';
import { useAuthStore } from '@/features/auth/store';
import { useEggsLive } from '@/features/eggs/runtime';

import { postReaction, useMyDeliveries, useMyOpenSession } from './queries';
import { flushQueue } from './queue';
import { syncCheckInReminders } from './reminders';
import { bannerDelivery, PromptBanner } from './ui/PromptBanner';
import { useReactionEngine } from './useReactionEngine';

/**
 * Lives for the session, above the navigator, and does the four things a check-in session
 * needs wherever the app is: runs the phone-side engine for my open session, shows the prompt
 * banner when one reaches me, posts captures that were queued offline once the app is back,
 * and keeps the 30-minute check-in reminders in step with the games I am going to. Nothing
 * in demo mode, and nothing while signed out.
 */
export function SessionRuntime() {
  const userId = useAuthStore((s) => s.userId);
  const live = useEggsLive();
  const enabled = !!userId && live;
  const session = useMyOpenSession(enabled);
  const gameId = session.data?.game_id ?? null;
  useReactionEngine(gameId, enabled && !!gameId);

  const deliveries = useMyDeliveries(gameId ?? undefined, enabled && !!gameId);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!gameId) return;
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, [gameId]);
  const banner = useMemo(() => bannerDelivery(deliveries.data, now, dismissed), [deliveries.data, now, dismissed]);

  // Queued captures go out when the app comes back, and once on mount.
  useEffect(() => {
    if (!userId || !live) return;
    const flush = () => void flushQueue((input) => postReaction(userId, input)).catch(() => {});
    flush();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') flush();
    });
    return () => sub.remove();
  }, [userId, live]);

  // Reminders for the games I said I am going to.
  const attendances = useMyAttendances();
  const going = attendances.data;
  useEffect(() => {
    if (!enabled || !going) return;
    void syncCheckInReminders(
      going
        .filter((a) => a.status === 'going')
        .map((a) => ({
          id: a.game.id,
          scheduled_start: a.game.scheduled_start,
          home: a.game.home?.name ?? null,
          away: a.game.away?.name ?? null,
          venue: a.game.venue?.name ?? null,
        })),
    );
  }, [enabled, going]);

  if (!banner) return null;
  return <PromptBanner delivery={banner} onDismiss={() => setDismissed((d) => new Set(d).add(banner.prompt_id))} />;
}
