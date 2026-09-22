import React from 'react';
import { AppState, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useMyAttendances } from '@/features/attendances/queries';
import { useAuthStore } from '@/features/auth/store';
import { useLiveState } from '@/features/checkin/queries';
import { env } from '@/lib/env';
import { useTheme } from '@/theme/ThemeProvider';

import { eggs } from './flags';
import { confettiPieces, seedFrom, type ConfettiPiece } from './layout';
import {
  activeCheckIn,
  EGG_SPORTS,
  eggLiveFrom,
  hasLiveFeed,
  isStretchTime,
  liveIsFresh,
} from './live';
import { PIECES } from './pieces';
import { lightHaptic, useNow } from './runtime';
import { useEggPreview, useEggStore, useEggStoreHydrated } from './store';

/** How long the shower lasts. */
export const SHOWER_MS = 2500;

/**
 * After the app comes to the front, how long it keeps looking for the break. The egg is for
 * opening the app during the stretch, not for having it open when the stretch arrives; and the
 * server only refreshes live state once a minute, so "now" needs a little room.
 */
export const OPENING_WINDOW_MS = 90_000;

/**
 * One shower of a sport's pieces over the whole screen. Mounted only while it falls; touches
 * pass through. Reduce Motion: the caller never mounts it.
 */
export function ConfettiShower({
  sport,
  seed,
  onDone,
}: {
  sport: string;
  seed: number;
  onDone: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const theme = useTheme();
  const clock = useSharedValue(0);
  const pieces = React.useMemo(
    () => confettiPieces(seed, EGG_SPORTS[sport]?.pieces ?? []),
    [seed, sport],
  );
  const colors = [theme.accent.text, theme.colors.ink, theme.colors.gold];

  React.useEffect(() => {
    clock.value = withTiming(1, { duration: SHOWER_MS, easing: Easing.linear });
    const done = setTimeout(onDone, SHOWER_MS + 60);
    return () => clearTimeout(done);
    // Plays once per mount, by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.layer]} testID="egg-confetti">
      {pieces.map((piece, i) => (
        <Falling key={i} piece={piece} clock={clock} width={width} height={height}>
          {React.createElement(PIECES[piece.kind], {
            size: piece.size,
            color: colors[i % colors.length] as string,
            fill: theme.colors.card,
          })}
        </Falling>
      ))}
    </View>
  );
}

function Falling({
  piece,
  clock,
  width,
  height,
  children,
}: {
  piece: ConfettiPiece;
  clock: SharedValue<number>;
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  const { delay, duration, drift, rotate, spin, size } = piece;
  const travel = height + size * 2;
  const style = useAnimatedStyle(() => {
    const local = Math.min(1, Math.max(0, (clock.value - delay) / duration));
    // A touch of gravity, and a sway so nothing falls in a ruled line.
    const fall = local * (0.55 + 0.45 * local);
    const sway = Math.sin(local * Math.PI * 2) * 10;
    return {
      opacity: local <= 0 ? 0 : local > 0.85 ? (1 - local) / 0.15 : 1,
      transform: [
        { translateX: drift * width * local + sway },
        { translateY: travel * fall },
        { rotate: `${rotate + spin * local}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[{ position: 'absolute', top: -size * 2, left: piece.x * (width - size) }, style]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * The stretch-time egg, mounted once beside the navigator. At rest it renders nothing.
 *
 * When the app comes to the front (or starts) while the person is checked in to a live game,
 * it looks at that game's live state for a short while; if the game is in its sport's signature
 * break, it showers once and remembers the game on this device.
 */
export function StretchConfetti() {
  const reduceMotion = useReducedMotion();
  // Demo mode is the build flag here and nothing else. `useEggsLive` would also ask the
  // repository, and asking for it at the root would start every Passport query before there is
  // a Passport. No test or harness hands the root a repository of its own.
  const live = !env.demo;
  const userId = useAuthStore((state) => state.userId);
  const hydrated = useEggStoreHydrated();
  const [shower, setShower] = React.useState<{ sport: string; seed: number } | null>(null);

  const armed = eggs.stretchConfetti && live && !!userId && hydrated && !reduceMotion;

  // The dev page's Play buttons. They work whatever the flag says, which is the point of them.
  React.useEffect(
    () =>
      useEggPreview.subscribe((state, before) => {
        if (reduceMotion || !state.confetti || state.confetti === before.confetti) return;
        setShower({ sport: state.confetti.sport, seed: state.confetti.nonce });
      }),
    [reduceMotion],
  );

  return (
    <>
      {armed ? <StretchWatch onStretch={(sport, seed) => setShower({ sport, seed })} /> : null}
      {shower ? (
        <ConfettiShower
          key={`${shower.sport}:${shower.seed}`}
          sport={shower.sport}
          seed={shower.seed}
          onDone={() => setShower(null)}
        />
      ) : null}
    </>
  );
}

/** Looks, draws nothing. Split out so none of its queries exist while the egg cannot run. */
function StretchWatch({ onStretch }: { onStretch: (sport: string, seed: number) => void }) {
  const attendances = useMyAttendances();
  const now = useNow(attendances.data);
  const shown = useEggStore((state) => state.confettiGames);
  const markConfetti = useEggStore((state) => state.markConfetti);
  const active = React.useMemo(() => activeCheckIn(attendances.data, now), [attendances.data, now]);

  // Open for a while after each arrival at the front, then shut until the next one.
  const [opening, setOpening] = React.useState(true);
  React.useEffect(() => {
    let timer = setTimeout(() => setOpening(false), OPENING_WINDOW_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      clearTimeout(timer);
      if (state === 'active') {
        setOpening(true);
        timer = setTimeout(() => setOpening(false), OPENING_WINDOW_MS);
      } else {
        setOpening(false);
      }
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  const pending = !!active && hasLiveFeed(active.sport) && !shown.includes(active.gameId);
  const liveState = useLiveState(active?.gameId, active?.sport, pending && opening);
  // A row left in the cache from an earlier look is not "now". Only a fresh one counts.
  const stretch =
    pending &&
    opening &&
    liveIsFresh(liveState.data?.fetched_at, now) &&
    isStretchTime({ sport: active.sport, live: eggLiveFrom(liveState.data) });

  React.useEffect(() => {
    if (!stretch || !active) return;
    markConfetti(active.gameId);
    lightHaptic();
    onStretch(active.sport, seedFrom(active.gameId));
  }, [active, markConfetti, onStretch, stretch]);

  return null;
}

const s = StyleSheet.create({
  layer: { zIndex: 50 },
});
