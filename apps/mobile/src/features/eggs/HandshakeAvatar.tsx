import React from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { PersonAvatar } from '@/components/PersonAvatar';
import { useTheme } from '@/theme/ThemeProvider';

import type { HandshakeState } from './handshake';

/** One slow turn of the waiting ring. Slow enough to read as "waiting", not "loading". */
const TURN_MS = 9000;
const GAP = 3;
const STROKE = 2;

type Props = {
  userId: string;
  name: string;
  handle?: string | null;
  path?: string | null;
  size?: number;
  /** Undefined: nothing offered yet. */
  state: HandshakeState | undefined;
  /** Present only when a tap would be accepted. */
  onPress?: () => void;
};

/**
 * A friend's avatar on the "Also there" list, for the secret handshake (`./handshake`).
 *
 * Untouched it is a plain avatar that happens to be tappable: the egg is a secret. After a tap
 * it wears a dashed ring in the accent colour that turns slowly while the other person has not
 * answered, and holds still under Reduce Motion, where the dashes alone say "not yet". Once both
 * have tapped the ring closes.
 */
export function HandshakeAvatar({ userId, name, handle, path, size = 38, state, onPress }: Props) {
  const outer = size + (GAP + STROKE) * 2;
  const body = (
    <View style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>
      {state ? <Ring outer={outer} dashed={state === 'waiting'} /> : null}
      <PersonAvatar userId={userId} name={name} handle={handle} path={path} size={size} />
    </View>
  );
  if (!onPress) {
    return (
      <View
        testID={`handshake-avatar-${userId}`}
        accessible={!!state}
        accessibilityLabel={
          state === 'waiting'
            ? `Handshake offered to ${name}. Waiting for theirs.`
            : state === 'complete'
              ? `Secret handshake with ${name}`
              : undefined
        }
      >
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={`handshake-avatar-${userId}`}
      accessibilityRole="button"
      accessibilityLabel={`Offer ${name} a handshake`}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {body}
    </Pressable>
  );
}

function Ring({ outer, dashed }: { outer: number; dashed: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);

  React.useEffect(() => {
    if (!dashed || reduceMotion) {
      turn.value = 0;
      return;
    }
    turn.value = withRepeat(withTiming(360, { duration: TURN_MS, easing: Easing.linear }), -1);
  }, [dashed, reduceMotion, turn]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  const r = (outer - STROKE) / 2;
  return (
    <Animated.View
      testID={dashed ? 'handshake-ring-waiting' : 'handshake-ring-complete'}
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: 0, width: outer, height: outer }, style]}
    >
      <Svg width={outer} height={outer}>
        <Circle
          cx={outer / 2}
          cy={outer / 2}
          r={r}
          fill="none"
          stroke={theme.accent.text}
          strokeWidth={STROKE}
          strokeLinecap="round"
          {...(dashed ? { strokeDasharray: '5 5' } : null)}
        />
      </Svg>
    </Animated.View>
  );
}
