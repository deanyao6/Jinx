import { requireOptionalNativeModule } from 'expo';
import React from 'react';

/**
 * Shake detection for the rally cap, on the accelerometer from `expo-sensors`.
 *
 * `expo-sensors` was added after the simulator build and TestFlight build 4 were made, and its
 * JavaScript asks for its native module the moment it is imported, which throws in a binary
 * that does not have one. So it is never imported at the top of a file. It is required here,
 * lazily, only after checking that the native module exists, inside a try. In an older binary
 * (and under Jest without a mock) this quietly reports "no shake", and the press-and-hold on
 * the wordmark is the way in. The simulator cannot shake either way.
 */

type Measurement = { x: number; y: number; z: number };
type Subscription = { remove: () => void };
type AccelerometerLike = {
  addListener: (listener: (m: Measurement) => void) => Subscription;
  setUpdateInterval: (ms: number) => void;
};

let cached: AccelerometerLike | null | undefined;

export function loadAccelerometer(): AccelerometerLike | null {
  if (cached !== undefined) return cached;
  try {
    if (!requireOptionalNativeModule('ExponentAccelerometer')) {
      cached = null;
      return cached;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sensors = require('expo-sensors') as { Accelerometer?: AccelerometerLike };
    cached = sensors.Accelerometer ?? null;
  } catch {
    cached = null;
  }
  return cached;
}

/** For tests: forget what was found, so the next call looks again. */
export function resetAccelerometerCache(): void {
  cached = undefined;
}

/** In g. At rest the magnitude is 1; a deliberate shake passes 2 easily, a walk does not. */
export const SHAKE_THRESHOLD_G = 2.2;
/** Jolts past the threshold, within the window, that make a shake. One bump is not a shake. */
export const SHAKE_JOLTS = 3;
export const SHAKE_WINDOW_MS = 900;
/** After a shake, how long before another can count. */
export const SHAKE_DEBOUNCE_MS = 1500;

/**
 * The detector, with no sensor in it: feed it readings and the time, and it says when a shake
 * has happened. Magnitude threshold, a few jolts close together, then a debounce.
 */
export function createShakeDetector(onShake: () => void) {
  let jolts: number[] = [];
  let quietUntil = 0;
  return (m: Measurement, now: number) => {
    if (now < quietUntil) return;
    const magnitude = Math.sqrt(m.x * m.x + m.y * m.y + m.z * m.z);
    if (magnitude < SHAKE_THRESHOLD_G) return;
    jolts = jolts.filter((t) => now - t <= SHAKE_WINDOW_MS);
    jolts.push(now);
    if (jolts.length >= SHAKE_JOLTS) {
      jolts = [];
      quietUntil = now + SHAKE_DEBOUNCE_MS;
      onShake();
    }
  };
}

/**
 * Listens for a shake only while `active`. The accelerometer is a battery cost, so the caller
 * keeps `active` true for exactly as long as a shake could mean something, and the listener is
 * removed the moment it is not.
 */
export function useShake(active: boolean, onShake: () => void): void {
  const latest = React.useRef(onShake);
  React.useEffect(() => {
    latest.current = onShake;
  }, [onShake]);

  React.useEffect(() => {
    if (!active) return;
    const accelerometer = loadAccelerometer();
    if (!accelerometer) return;
    let subscription: Subscription | null = null;
    try {
      accelerometer.setUpdateInterval(100);
      const detect = createShakeDetector(() => latest.current());
      subscription = accelerometer.addListener((m) => detect(m, Date.now()));
    } catch {
      subscription = null;
    }
    return () => {
      try {
        subscription?.remove();
      } catch {
        // Already gone.
      }
    };
  }, [active]);
}
