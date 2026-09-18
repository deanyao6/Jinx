import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { estimateLock, formatCountdown, lockRuleCopy, pctLabel } from '@/features/checkin/lock';
import { hasLiveFeed } from '@/features/eggs/live';
import { useLiveState, useMakePledge, type GameContext } from '@/features/checkin/queries';
import { useSeasonRecords } from '@/features/checkin/records';
import { pickASideFromContext, type TeamRef } from '@/features/data/supabase';
import { pickConfirmation } from '@/features/demo/fixtures';
import { cancelPledgeReminder, schedulePledgeReminder } from '@/features/notifications/push';
import { storylineCards, useStorylines } from '@/features/storylines/queries';
import { useTeams } from '@/features/teams/queries';
import { ReferenceThemeProvider } from '@/theme/reference/TeamTheme';

import { PickASideView, type PickASideData } from './PickASideScreen';

/**
 * Pick a side for a real game (SPEC.md 6.4, 8.8.3, M5).
 *
 * The reference screen used to render only the repository's empty state, because a repository
 * holds one user's aggregate data and this screen is about one game. It is mounted here from a
 * check-in at a neutral game instead, with that game's context. The lock rules, the pledge RPC
 * and their validation already existed and are tested (packages/core/src/pledge.test.ts,
 * supabase/tests/004); this is the screen and the flow around them.
 */
export function PickASideLive({ gameId, ctx }: { gameId: string; ctx: GameContext }) {
  return (
    <ReferenceThemeProvider team="none">
      <Live gameId={gameId} ctx={ctx} />
    </ReferenceThemeProvider>
  );
}

/** Why a pick was refused, in words. The reasons are `make_pledge`'s. */
export function pledgeFailureText(reason: string): string {
  switch (reason) {
    case 'not_checked_in':
      return 'Check in at the game first, then pick a side.';
    case 'not_neutral':
      return 'You follow one of these teams, so your side is already set.';
    case 'game_over':
      return 'This game is over, so picks are closed.';
    case 'already_validated':
      return 'Your pick for this game has already been settled.';
    default:
      return 'That pick did not go through. Try again.';
  }
}

/**
 * What the line under the buttons says. Pure so it can be tested without a clock.
 * `undefined` means "use the reference's own confirmation copy".
 */
export function pickStatusText(opts: {
  locked: boolean;
  gameOver: boolean;
  pickedName: string | null;
  pickedProb: number | null;
}): string | null | undefined {
  const { locked, gameOver, pickedName, pickedProb } = opts;
  if (!locked) return pickedName ? pickConfirmation(pickedName, pickedProb ?? 0.5) : null;
  if (pickedName) {
    return `Locked in: the ${pickedName}, ${pctLabel(pickedProb ?? 0.5)} to win when you picked. The result posts once the game is final.`;
  }
  return gameOver
    ? 'The game ended before you picked, so it stays neutral on your record.'
    : 'No pick before the lock, so this game stays neutral on your record.';
}

function Live({ gameId, ctx }: { gameId: string; ctx: GameContext }) {
  const router = useRouter();
  const pledge = useMakePledge();
  const teams = useTeams(false);
  const storylines = useStorylines(gameId, { poll: true });
  const records = useSeasonRecords(gameId, ctx.home.team_id, ctx.away.team_id);
  const [now, setNow] = useState(() => Date.now());
  const [failure, setFailure] = useState<string | null>(null);

  const p = ctx.pledge;
  const gameOver = ctx.status === 'final';
  // MLB and the NBA have a live feed, polled every 60s while checked in: MLB locks the moment
  // it shows a run or the end of the 1st, the NBA at the end of the 1st quarter. NFL has none
  // in v1, so its timer is an estimate (SPEC 6.4.4).
  const live = useLiveState(gameId, hasLiveFeed(ctx.sport_id) && !gameOver);
  const lock = estimateLock(
    ctx.sport_id,
    ctx.scheduled_start,
    live.data ?? null,
    now,
    ctx.estimated_lock_at,
  );
  const locked = lock.locked || gameOver;

  useEffect(() => {
    if (locked) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [locked]);

  // SPEC 6.4.1: a local notification if the user leaves this screen without picking. Scheduled
  // on blur, cancelled on return and on a pick.
  const reminder = useRef({ needed: false, lockAtMs: 0 });
  useEffect(() => {
    reminder.current = { needed: !p && !locked, lockAtMs: Date.parse(lock.at) };
  }, [p, locked, lock.at]);
  useFocusEffect(
    useCallback(() => {
      void cancelPledgeReminder(gameId);
      return () => {
        const r = reminder.current;
        if (r.needed) void schedulePledgeReminder(gameId, r.lockAtMs);
      };
    }, [gameId]),
  );

  const teamRefs = useMemo(() => {
    const map = new Map<string, TeamRef>();
    for (const t of teams.data ?? []) map.set(t.id, t);
    return map;
  }, [teams.data]);

  const data: PickASideData = useMemo(() => {
    const rows = storylineCards(storylines.data ?? [], {
      home: ctx.home.team_id,
      away: ctx.away.team_id,
    });
    const base = pickASideFromContext(ctx, teamRefs, [], formatCountdown(lock.at, now));
    return {
      ...base,
      // The rule, in words, next to the timer. For the NFL the timer is only an estimate and
      // the copy has to say so (SPEC 6.4.4).
      explainer: `${base.explainer} ${lockRuleCopy(ctx.sport_id)}.`,
      away: { ...base.away, record: records.data?.away ?? '' },
      home: { ...base.home, record: records.data?.home ?? '' },
      storylines: rows.map((r) => ({ text: r.text, source: r.source })),
    };
  }, [ctx, teamRefs, storylines.data, records.data, lock.at, now]);

  const picked = p ? (p.team_id === ctx.away.team_id ? 'away' : 'home') : undefined;
  const pickedSide = picked ? data[picked] : null;

  const onPick = async (side: 'away' | 'home') => {
    if (locked) return;
    const teamId = side === 'away' ? ctx.away.team_id : ctx.home.team_id;
    if (p?.team_id === teamId) return;
    setFailure(null);
    try {
      // The mutation writes the returned context into the cache, which is what flips `picked`.
      const res = await pledge.mutateAsync({ gameId, teamId });
      if (!res.ok) setFailure(pledgeFailureText(res.reason));
      else void cancelPledgeReminder(gameId);
    } catch {
      setFailure('That pick did not go through. Check your connection and try again.');
    }
  };

  return (
    <PickASideView
      data={data}
      picked={picked}
      onPick={(side) => void onPick(side)}
      locked={locked}
      busy={pledge.isPending}
      statusText={pickStatusText({
        locked,
        gameOver,
        pickedName: pickedSide?.name ?? null,
        // What the pledge froze, not today's number: that is what the result is scored against.
        pickedProb: p?.win_prob_at_pledge ?? pickedSide?.winProb ?? null,
      })}
      errorText={failure}
      storylinesNote={
        storylines.isPending
          ? 'Loading storylines…'
          : storylines.isError
            ? 'Storylines could not be loaded.'
            : 'No storylines for this game yet. They are written from results on the day of the game.'
      }
      onBack={() => (router.canGoBack() ? router.back() : router.replace(`/games/${gameId}`))}
    />
  );
}
