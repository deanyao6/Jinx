import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the system's Reduce Motion setting is on, kept current while the screen is up.
 *
 * Reanimated's `useReducedMotion` reads the setting once at startup and never again; this
 * screen is the first thing a new user sees, so it also listens for the change, and every
 * loop on the wall stops and the counters land on their final values the moment it flips.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (!cancelled) setReduce(on);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
  return reduce;
}
