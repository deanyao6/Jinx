import React from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Seal } from '@/components/reference/Seal';

import { WALL } from '../styles';

/** `.sealcard svg{width:88px;height:88px}` */
const SIZE = 88;
/** The card the reference lays out around it: 92px tall, the seal centred. */
const CARD = 92;
/** `filter: drop-shadow(0 8px 14px rgba(0,0,0,.45))`. */
const SHADOW = { dy: 8, blur: 14, alpha: 0.45 };

/** `@keyframes sheen`: still until 62% of 7s, across by 76%, still again until the loop. */
export const SHEEN = {
  periodMs: 7000,
  restMs: 4340,
  sweepMs: 980,
  holdMs: 1680,
  /** `translateX(-140%)` to `140%` of the seal's width. */
  travel: SIZE * 1.4,
} as const;

/**
 * `.sealcard`: a brass or silver stadium seal with no card behind it, and on brass a gold
 * sheen that sweeps across now and then.
 *
 * The seal is the shared `Seal`, exactly as the reference's `seal()` draws it, with the
 * outer dashed rule in the welcome reference's 50% white. Two things are drawn differently
 * from the CSS and noted in design/PORTING_NOTES.md: the drop shadow is a soft disc under
 * the seal rather than a shadow filter, and the sheen is a moving gradient view clipped to
 * the disc rather than a background-image transform.
 */
export const SealCard = React.memo(function SealCard({
  id,
  ring,
  shape,
  metal,
  still,
}: {
  id: string;
  ring: string;
  shape: string;
  metal: 'brass' | 'silver';
  /** Hold the sheen at its start: Reduce Motion, or the frozen screenshot state. */
  still: boolean;
}) {
  const shadowSize = SIZE + SHADOW.blur * 2;
  return (
    <View style={{ height: CARD, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        pointerEvents="none"
        width={shadowSize}
        height={shadowSize}
        style={{ position: 'absolute', top: (CARD - SIZE) / 2 - SHADOW.blur + SHADOW.dy }}
      >
        <Defs>
          <RadialGradient id={`ss-${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#000000" stopOpacity={SHADOW.alpha} />
            <Stop offset="0.62" stopColor="#000000" stopOpacity={SHADOW.alpha * 0.55} />
            <Stop offset="1" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={shadowSize / 2} cy={shadowSize / 2} r={shadowSize / 2} fill={`url(#ss-${id})`} />
      </Svg>
      <View style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: 'hidden' }}>
        <Seal ring={ring} shapeKey={shape} metal={metal} size={SIZE} inkColor="rgba(255,255,255,0.5)" />
        {metal === 'brass' ? <Sheen id={id} still={still} /> : null}
      </View>
    </View>
  );
});

/**
 * `.sheen`: `linear-gradient(105deg, transparent 38%, rgba(255,255,255,.55) 48%, transparent 58%)`
 * over the whole disc, translated from -140% to 140% between 62% and 76% of a 7s loop, eased
 * in and out. It starts at -140%, off the disc, which is also its Reduce Motion state.
 */
function Sheen({ id, still }: { id: string; still: boolean }) {
  const x = useSharedValue(-SHEEN.travel);

  React.useEffect(() => {
    if (still) {
      x.value = -SHEEN.travel;
      return;
    }
    x.value = -SHEEN.travel;
    x.value = withRepeat(
      withSequence(
        withDelay(
          SHEEN.restMs,
          withTiming(SHEEN.travel, {
            duration: SHEEN.sweepMs,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        withDelay(SHEEN.holdMs, withTiming(-SHEEN.travel, { duration: 1 })),
      ),
      -1,
      false,
    );
  }, [still, x]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  // 105deg through the centre of a square: the line runs from the left edge a little above
  // centre to the right edge a little below it (GradientFill.tsx has the derivation).
  const a = (105 * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = (Math.abs(dx) + Math.abs(dy)) / 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: 0, width: SIZE, height: SIZE }, style]}
    >
      <Svg width={SIZE} height={SIZE}>
        <Defs>
          <LinearGradient
            id={`sheen-${id}`}
            x1={0.5 - dx * half}
            y1={0.5 - dy * half}
            x2={0.5 + dx * half}
            y2={0.5 + dy * half}
          >
            <Stop offset="0.38" stopColor={WALL.white} stopOpacity="0" />
            <Stop offset="0.48" stopColor={WALL.white} stopOpacity="0.55" />
            <Stop offset="0.58" stopColor={WALL.white} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={SIZE} height={SIZE} fill={`url(#sheen-${id})`} />
      </Svg>
    </Animated.View>
  );
}
