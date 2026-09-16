import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/theme/reference/tokens';

/**
 * A panel that slides in from the right over the screen beneath it, matching `.panel` in
 * `design/reference.html`:
 *
 *     transform: translateX(100%);
 *     transition: transform .32s cubic-bezier(.2,.8,.2,1);
 *
 * Reduce Motion is honoured per SPEC.md 8.2: the panel still opens and closes, it just
 * arrives immediately instead of sliding. The panel is a presentation change, not
 * information, so there is nothing to lose by skipping the travel.
 *
 * `initiallyOpen` mounts it already in place with no animation. The visual parity harness
 * uses that to capture the open state, and the two-identical-frames check in
 * capture-app.mjs would otherwise reject a screen caught mid-transition.
 */
export function SlideOver({
  open,
  initiallyOpen = false,
  children,
}: {
  open: boolean;
  initiallyOpen?: boolean;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  // 1 is fully off-screen to the right, 0 is in place, mirroring translateX(100%).
  const offset = useSharedValue(initiallyOpen ? 0 : 1);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const target = open ? 0 : 1;
    offset.value = reduceMotion
      ? target
      : withTiming(target, {
          duration: motion.panelMs,
          easing: Easing.bezier(...motion.panelEasing),
        });
  }, [open, offset, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value * width }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.panel, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityViewIsModal={open}
      aria-hidden={!open}
    >
      <View style={StyleSheet.absoluteFill}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // `.panel{z-index:5}`. The background comes from the panel's own screen.
  panel: { zIndex: 5 },
});
