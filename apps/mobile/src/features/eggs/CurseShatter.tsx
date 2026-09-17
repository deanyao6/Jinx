import { useIsFocused } from 'expo-router';
import React from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { ICONS } from '@/components/reference/icons';
import { useAuthStore } from '@/features/auth/store';
import { env } from '@/lib/env';
import { fontFamily } from '@/theme/fonts';

import { curseBroken, curseLine, type CurseBroken } from './curse';
import { eggs } from './flags';
import { mirrorShards, seedFrom, type Shard } from './layout';
import { lightHaptic, useAttendedGames } from './runtime';
import { useEggStore, useEggStoreHydrated } from './store';

/** The whole egg, in ms: crack, hold a beat, fall, and the line stays a few seconds more. */
const TOTAL_MS = 4600;
const CRACK_MS = 140;
const FALL_AT_MS = 720;
const FALL_STAGGER_MS = 420;
const FALL_MS = 780;
const LINE_IN_MS = 320;
const LINE_OUT_AT_MS = 4000;

/**
 * The shards and the line, over whatever it is laid on. Plays once from mount and calls
 * `onDone`; the parent then unmounts it, so nothing of it exists at rest. Touches pass through.
 *
 * Reduce Motion: no glass at all. The line alone appears, stays as long, and goes.
 */
export function CurseShatter({
  losses,
  seed,
  onDone,
}: {
  losses: number;
  seed: number;
  onDone?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null);
  const shards = React.useMemo(() => mirrorShards(seed), [seed]);
  const clock = useSharedValue(0);
  const Spark = ICONS['i-spark'];

  React.useEffect(() => {
    clock.value = reduceMotion
      ? LINE_IN_MS / TOTAL_MS
      : withTiming(1, { duration: TOTAL_MS, easing: Easing.linear });
    const done = setTimeout(() => onDone?.(), TOTAL_MS + 60);
    return () => clearTimeout(done);
    // Plays once per mount, by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lineStyle = useAnimatedStyle(() => {
    const ms = clock.value * TOTAL_MS;
    const fadeIn = Math.min(1, Math.max(0, ms / LINE_IN_MS));
    const fadeOut = Math.min(1, Math.max(0, (TOTAL_MS - ms) / (TOTAL_MS - LINE_OUT_AT_MS)));
    return { opacity: Math.min(fadeIn, fadeOut) };
  });

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) =>
        setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
      }
      testID="curse-shatter"
    >
      {size && !reduceMotion
        ? shards.map((shard, i) => (
            <ShardView key={i} shard={shard} index={i} size={size} clock={clock} />
          ))
        : null}
      <Animated.View style={[s.line, lineStyle]}>
        <Spark size={13} color="#FFFFFF" />
        <Text style={s.lineText} numberOfLines={1} allowFontScaling={false}>
          {curseLine(losses)}
        </Text>
      </Animated.View>
    </View>
  );
}

function ShardView({
  shard,
  index,
  size,
  clock,
}: {
  shard: Shard;
  index: number;
  size: { width: number; height: number };
  clock: SharedValue<number>;
}) {
  // Each shard is its own small view, the size of its bounding box, so it turns about its own
  // middle as it falls rather than about the middle of the hero.
  const xs = shard.points.map((p) => p.x * size.width);
  const ys = shard.points.map((p) => p.y * size.height);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(1, Math.max(...xs) - left);
  const height = Math.max(1, Math.max(...ys) - top);
  const points = xs.map((x, i) => `${x - left},${(ys[i] as number) - top}`).join(' ');
  const startMs = FALL_AT_MS + shard.delay * FALL_STAGGER_MS;
  const fallBy = size.height * 0.95;
  const driftBy = shard.drift * size.width;
  const spin = shard.spin;

  const style = useAnimatedStyle(() => {
    const ms = clock.value * TOTAL_MS;
    const crack = Math.min(1, ms / CRACK_MS);
    const local = Math.min(1, Math.max(0, (ms - startMs) / FALL_MS));
    // Gravity: slow to let go, then quick.
    const fall = local * local;
    return {
      opacity: crack * (1 - fall),
      transform: [
        { translateX: driftBy * fall },
        { translateY: fallBy * fall },
        { rotate: `${spin * fall}deg` },
        // The jolt of the crack: a hair too big, settling at once.
        { scale: 1 + 0.02 * (1 - crack) },
      ],
    };
  });

  // Neighbouring pieces of a broken mirror catch the light differently.
  const glass = 0.1 + ((index * 7) % 5) * 0.03;
  return (
    <Animated.View style={[{ position: 'absolute', left, top, width, height }, style]}>
      <Svg width={width} height={height}>
        <Polygon
          points={points}
          fill={`rgba(226,232,240,${glass.toFixed(2)})`}
          stroke="rgba(255,255,255,0.8)"
          strokeWidth={1}
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

/**
 * The Passport's curse breaker. Draws nothing until the person's latest win has ended a losing
 * run of five or more that this device has not celebrated yet; then it hands over to
 * {@link CurseOnFocus}, which waits for the Passport to be the screen in front.
 */
export function CurseBreaker() {
  const userId = useAuthStore((state) => state.userId);
  const games = useAttendedGames();
  const hydrated = useEggStoreHydrated();
  const celebrated = useEggStore((state) => (userId ? state.curseCelebrated[userId] : undefined));
  const broken = React.useMemo(() => curseBroken(games), [games]);
  // Once it starts it runs to the end, even though starting it is what marks it celebrated.
  const [playing, setPlaying] = React.useState<CurseBroken | null>(null);

  if (!eggs.curseBreaker || env.demo || !userId || !hydrated) return null;
  const due = broken && celebrated !== broken.gameId ? broken : null;
  const show = playing ?? due;
  if (!show) return null;
  return (
    <CurseOnFocus
      broken={show}
      userId={userId}
      playing={playing != null}
      onStart={() => setPlaying(show)}
      onDone={() => setPlaying(null)}
    />
  );
}

/** The tabs stay mounted, so "opens the Passport" is "the Passport has focus", not "mounted". */
function CurseOnFocus({
  broken,
  userId,
  playing,
  onStart,
  onDone,
}: {
  broken: CurseBroken;
  userId: string;
  playing: boolean;
  onStart: () => void;
  onDone: () => void;
}) {
  const focused = useIsFocused();
  const celebrate = useEggStore((state) => state.celebrateCurse);

  React.useEffect(() => {
    if (!focused || playing) return;
    celebrate(userId, broken.gameId);
    lightHaptic();
    AccessibilityInfo.announceForAccessibility(curseLine(broken.losses));
    onStart();
  }, [broken.gameId, broken.losses, celebrate, focused, onStart, playing, userId]);

  if (!playing) return null;
  return <CurseShatter losses={broken.losses} seed={seedFrom(broken.gameId)} onDone={onDone} />;
}

const s = StyleSheet.create({
  // A band over the hero's last row, which comes straight back when the line goes.
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    // The hero's own darkest colour. The hero is pinned dark in both schemes.
    backgroundColor: 'rgba(11,15,22,0.94)',
  },
  lineText: {
    fontSize: 11.5,
    fontFamily: fontFamily({ weight: 750 }),
    color: '#FFFFFF',
  },
});
