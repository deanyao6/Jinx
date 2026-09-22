import { useIsFocused } from 'expo-router';
import React from 'react';
import { AccessibilityInfo, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useMyAttendances } from '@/features/attendances/queries';
import { useAuthStore } from '@/features/auth/store';
import { useLiveState } from '@/features/checkin/queries';
import { env } from '@/lib/env';

import { eggs } from './flags';
import {
  activeCheckIn,
  eggLiveFrom,
  hasLiveFeed,
  rallyCapEligible,
  rallyCapShowing,
  type ActiveCheckIn,
} from './live';
import { lightHaptic, useNow } from './runtime';
import { useShake } from './shake';
import { useEggStore, useEggStoreHydrated } from './store';

/** How long the wordmark is held to flip the cap. The shake is the other way in. */
export const RALLY_HOLD_MS = 1000;

/**
 * Turns whatever it wraps upside down, on a spring, about its own centre: the cap turned over.
 * Reduce Motion gets the end state at once, with no travel.
 *
 * A flat half turn, not a 3D `rotateX`. With a perspective transform iOS composited the wordmark
 * on its own layer and clipped the text beside it to the wordmark's width, and the letters came
 * out mirrored rather than upside down. Turned flat, it reads as JINX on its head, which is the
 * joke, and it leaves its neighbours alone.
 */
export function Flippable({ flipped, children }: { flipped: boolean; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(flipped ? 1 : 0);

  React.useEffect(() => {
    const target = flipped ? 1 : 0;
    turn.value = reduceMotion
      ? target
      : withSpring(target, { damping: 11, stiffness: 120, mass: 0.9 });
  }, [flipped, reduceMotion, turn]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${turn.value * 180}deg` },
      // A small dip through the middle of the turn, so it feels thrown rather than dialled.
      { scale: 1 - 0.12 * Math.sin(Math.PI * Math.min(Math.max(turn.value, 0), 1)) },
    ],
  }));
  return <Animated.View style={[{ alignSelf: 'flex-start' }, style]}>{children}</Animated.View>;
}

/**
 * The JINX wordmark on the Passport, with the rally cap on top of it.
 *
 * At rest, which is nearly always, this returns its child untouched: no wrapper, no listener,
 * no query. It only becomes something when the person is checked in to a game right now, or a
 * cap flipped earlier is still on.
 */
export function RallyCapWordmark({ children }: { children: React.ReactElement }) {
  const userId = useAuthStore((state) => state.userId);
  const attendances = useMyAttendances();
  const hydrated = useEggStoreHydrated();
  const caps = useEggStore((state) => (userId ? state.rallyCaps[userId] : undefined));
  const now = useNow(attendances.data);

  const active = React.useMemo(() => activeCheckIn(attendances.data, now), [attendances.data, now]);
  const wornGameId = React.useMemo(() => {
    const status = new Map((attendances.data ?? []).map((a) => [a.game.id, a.game.status]));
    const worn = Object.entries(caps ?? {}).find(([gameId, cap]) =>
      rallyCapShowing(cap, status.get(gameId), now),
    );
    return worn?.[0] ?? null;
  }, [attendances.data, caps, now]);

  if (!eggs.rallyCap || env.demo || !userId || !hydrated) return children;
  if (!active && !wornGameId) return children;
  return (
    <RallyCapLive userId={userId} active={active} wornGameId={wornGameId}>
      {children}
    </RallyCapLive>
  );
}

function RallyCapLive({
  userId,
  active,
  wornGameId,
  children,
}: {
  userId: string;
  active: ActiveCheckIn | null;
  wornGameId: string | null;
  children: React.ReactElement;
}) {
  const focused = useIsFocused();
  const flipRallyCap = useEggStore((state) => state.flipRallyCap);
  // Polled only for a sport that has a live feed at all. See `EGG_SPORTS`.
  const liveState = useLiveState(active?.gameId, active?.sport, !!active && hasLiveFeed(active.sport));
  const liveNow = eggLiveFrom(liveState.data);

  // The live state hears about the final before the games table does.
  const over = !!active && active.gameId === wornGameId && liveNow?.status === 'final';
  const flipped = wornGameId != null && !over;
  const eligible =
    !!active &&
    !flipped &&
    rallyCapEligible({ sport: active.sport, live: liveNow, rootingSide: active.rootingSide });

  const flip = React.useCallback(() => {
    if (!eligible || !active?.rootingTeamId) return;
    flipRallyCap(userId, active.gameId, { teamId: active.rootingTeamId, at: Date.now() });
    lightHaptic();
    AccessibilityInfo.announceForAccessibility('Rally cap on.');
  }, [active, eligible, flipRallyCap, userId]);

  // The accelerometer runs only while a shake could flip the cap and the Passport is in front.
  useShake(eligible && focused, flip);

  // One tree whether or not the hold is armed, so flipping never remounts the wordmark and
  // the spring always has somewhere to start from.
  return (
    <Pressable
      onLongPress={eligible ? flip : undefined}
      delayLongPress={RALLY_HOLD_MS}
      accessible={eligible}
      accessibilityRole="button"
      accessibilityLabel="Jinx. Flip your rally cap"
      accessibilityHint="Press and hold, or shake your phone"
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={flip}
      hitSlop={8}
      style={{ alignSelf: 'flex-start' }}
      testID="rally-cap-wordmark"
    >
      <Flippable flipped={flipped}>{children}</Flippable>
    </Pressable>
  );
}
