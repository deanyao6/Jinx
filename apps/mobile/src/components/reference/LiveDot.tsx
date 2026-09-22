import React from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/theme/reference/tokens';

/**
 * The pulsing dot on the live indicator, matching the reference's
 * `@keyframes pulse{50%{opacity:.3}}` at `animation: pulse 1.6s infinite`.
 *
 * CSS runs the keyframe from 1 to .3 and back over the full 1.6s, so each half is 800ms.
 *
 * Under Reduce Motion the dot holds at full opacity rather than pulsing (SPEC.md 8.2).
 * That is the right still frame: the dot means "live", and the pulse is decoration on top
 * of a state the colour already carries.
 */
export function LiveDot({
  color,
  size = 6,
  durationMs = motion.livePulseMs,
  low = 0.3,
  still = false,
}: {
  color: string;
  size?: number;
  /** One full pulse. The welcome wall's live card runs `pulse 1.5s` to 25%. */
  durationMs?: number;
  low?: number;
  /** Hold at full opacity, as Reduce Motion does: for a screen frozen for a screenshot. */
  still?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    if (reduceMotion || still) {
      opacity.value = 1;
      return;
    }
    opacity.value = 1;
    opacity.value = withRepeat(
      withTiming(low, { duration: durationMs / 2, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [durationMs, low, opacity, reduceMotion, still]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}
    />
  );
}
