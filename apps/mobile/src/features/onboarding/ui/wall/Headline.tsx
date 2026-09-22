import React from 'react';
import { Text, View } from 'react-native';
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { fontFamily } from '@/theme/fonts';

import { WALL } from './styles';

/**
 * `h2.hl`: "48 games. 14 stadiums." over "One record." in brass. The two numbers count up
 * from 0 on mount with a cubic ease-out, 48 over 1400ms and 14 over 1700ms, and again every
 * 9s (`countTo()` and `setInterval(run, 9000)` in the reference).
 *
 * One shared clock drives both on the UI thread: a linear 0 to 9000 that repeats. Each
 * counter is a function of it, and only the rounded value crosses to React, at most once per
 * step, so counting costs about sixty state updates per cycle and nothing between cycles.
 *
 * Under Reduce Motion, or frozen for a screenshot, the numbers are their final values and
 * nothing runs.
 */
export const COUNTERS = {
  games: 48,
  stadiums: 14,
  gamesMs: 1400,
  stadiumsMs: 1700,
  periodMs: 9000,
} as const;

export function countAt(target: number, elapsedMs: number, durationMs: number): number {
  'worklet';
  const k = Math.min(1, Math.max(0, elapsedMs / durationMs));
  return Math.round(target * (1 - Math.pow(1 - k, 3)));
}

function useCounter(clock: { value: number }, target: number, durationMs: number, still: boolean) {
  const [value, setValue] = React.useState(0);
  useAnimatedReaction(
    () => countAt(target, clock.value, durationMs),
    (current, previous) => {
      if (current !== previous) runOnJS(setValue)(current);
    },
    [target, durationMs],
  );
  // Still means the final value, whatever the clock last said; the clock itself is reset
  // to zero by the effect in Headline, so the reaction lands on 0 when motion resumes.
  return still ? target : value;
}

export function Headline({ still }: { still: boolean }) {
  const clock = useSharedValue(0);

  React.useEffect(() => {
    clock.value = 0;
    if (still) return;
    clock.value = withRepeat(
      withTiming(COUNTERS.periodMs, { duration: COUNTERS.periodMs, easing: Easing.linear }),
      -1,
      false,
    );
  }, [clock, still]);

  const games = useCounter(clock, COUNTERS.games, COUNTERS.gamesMs, still);
  const stadiums = useCounter(clock, COUNTERS.stadiums, COUNTERS.stadiumsMs, still);

  const heavy = fontFamily({ width: 100, weight: 900 });
  const counter = fontFamily({ width: 62, weight: 900 });
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${COUNTERS.games} games. ${COUNTERS.stadiums} stadiums. One record.`}
      style={{ marginTop: 14, marginBottom: 8 }}
    >
      <Text
        style={{
          fontFamily: heavy,
          fontSize: 29,
          lineHeight: 30.16,
          letterSpacing: -0.29,
          color: WALL.white,
        }}
      >
        <Text style={{ fontFamily: counter }}>{games}</Text> games.{' '}
        <Text style={{ fontFamily: counter }}>{stadiums}</Text> stadiums.
        {'\n'}
        <Text style={{ color: WALL.brass }}>One record.</Text>
      </Text>
    </View>
  );
}
