import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { fontFamily } from '@/theme/fonts';

import {
  formatTally,
  parseTally,
  replaySteps,
  replayTiming,
  rewindFrames,
  type ReplayStep,
} from './rewind';
import { lightHaptic, useAttendedGames } from './runtime';

/** How long the finger rests on the record before it starts to wind back. */
export const REWIND_HOLD_MS = 400;

const REWIND_FRAME_MS = 45;
const ZERO_HOLD_MS = 260;
const END_HOLD_MS = 1400;

type Frame = { text: string; caption: string; ms: number };

function framesFor(record: string, steps: readonly ReplayStep[]): Frame[] {
  const last = steps[steps.length - 1];
  if (!last) return [];
  const from = parseTally(record) ?? last;
  const { stepMs } = replayTiming(steps.length);
  const back = rewindFrames(from).map((t) => ({
    text: formatTally(t),
    caption: '',
    ms: REWIND_FRAME_MS,
  }));
  const zero = back[back.length - 1];
  if (zero) zero.ms = ZERO_HOLD_MS;
  const forward = steps.map((s) => ({ text: formatTally(s), caption: s.label, ms: stepMs }));
  const end = forward[forward.length - 1];
  if (end) end.ms = END_HOLD_MS;
  return [...back, ...forward];
}

/**
 * Plays the frames on a timer and hands back the one showing, or null at rest. At rest the
 * caller draws today's record, so the replay can never leave a wrong number behind: stopping,
 * finishing and unmounting all end on null.
 */
export function useRecordReplay(record: string, steps: readonly ReplayStep[]) {
  const reduceMotion = useReducedMotion();
  const [frame, setFrame] = React.useState<Frame | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const stop = React.useCallback(() => {
    clear();
    setFrame(null);
  }, [clear]);

  const start = React.useCallback(() => {
    // Reduce Motion: the egg is nothing but motion, so it is skipped and the record stays put.
    if (reduceMotion) return;
    const frames = framesFor(record, steps);
    if (frames.length === 0) return;
    clear();
    lightHaptic();
    const show = (index: number) => {
      const next = frames[index];
      if (!next) {
        timer.current = null;
        setFrame(null);
        return;
      }
      setFrame(next);
      timer.current = setTimeout(() => show(index + 1), next.ms);
    };
    show(0);
  }, [clear, record, reduceMotion, steps]);

  // A different record under the finger (another pill, a new game) ends the replay.
  React.useEffect(() => stop, [record, steps, stop]);

  return { frame, start, stop };
}

/**
 * The hero's record, with the replay on top of it.
 *
 * `draw` is the hero's own way of drawing the number, so at rest this is that exact element
 * inside a Pressable of the same size. The Pressable has no `onPress` and is not an
 * accessibility element: a tap does nothing, VoiceOver reads the record as it always did, and a
 * drag still scrolls, because the scroll view takes the touch back and that ends the replay
 * like lifting the finger does.
 */
export function RewindableRecord({
  record,
  steps,
  draw,
  playKey = 0,
}: {
  record: string;
  steps: readonly ReplayStep[];
  draw: (text: string) => React.ReactElement;
  /** The dev page plays it without a finger: each new number starts the replay. */
  playKey?: number;
}) {
  const { frame, start, stop } = useRecordReplay(record, steps);
  // The number gets narrower on the way to zero. Holding the resting width keeps the win rate
  // beside it from sliding about while it plays.
  const [restWidth, setRestWidth] = React.useState(0);

  const started = React.useRef(0);
  React.useEffect(() => {
    if (playKey > 0 && playKey !== started.current) {
      started.current = playKey;
      start();
    }
  }, [playKey, start]);

  return (
    <Pressable
      accessible={false}
      delayLongPress={REWIND_HOLD_MS}
      onLongPress={start}
      onPressOut={playKey > 0 ? undefined : stop}
      onLayout={(e) => {
        if (!frame) setRestWidth(e.nativeEvent.layout.width);
      }}
      style={frame && restWidth ? { minWidth: restWidth } : undefined}
      testID="record-rewind"
    >
      {draw(frame ? frame.text : record)}
      {frame?.caption ? (
        <Text style={s.caption} numberOfLines={1} allowFontScaling={false}>
          {frame.caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** The Passport's record: replays the games behind the pill in effect. */
export function RecordRewind({
  pill,
  record,
  draw,
}: {
  pill: string;
  record: string;
  draw: (text: string) => React.ReactElement;
}) {
  const games = useAttendedGames();
  const steps = React.useMemo(() => replaySteps(games, { pill }), [games, pill]);
  return <RewindableRecord record={record} steps={steps} draw={draw} />;
}

const s = StyleSheet.create({
  // Sits in the gap under the number, out of the layout, so nothing in the hero moves.
  caption: {
    position: 'absolute',
    left: 0,
    top: '100%',
    width: 300,
    marginTop: 1,
    fontSize: 9.5,
    lineHeight: 11,
    letterSpacing: 9.5 * 0.03,
    fontFamily: fontFamily({ weight: 650 }),
    // The hero is pinned dark in both schemes, as its other text is.
    color: 'rgba(255,255,255,0.72)',
  },
});
