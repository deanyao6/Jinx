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
export function LiveDot({ color, size = 6 }: { color: string; size?: number }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withTiming(0.3, { duration: motion.livePulseMs / 2, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}
    />
  );
}
