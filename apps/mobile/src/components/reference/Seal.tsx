import React, { useId, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
  Text,
  TextPath,
} from 'react-native-svg';

import { fontFamily } from '@/theme/fonts';

import { mix, sealColors, type SealMetal } from './sealColors';
import { wearMarks, type WearLevel } from './sealWear';
import { StadiumShape } from './StadiumShape';

export type { SealMetal, SealTint } from './sealColors';
export type { WearLevel } from './sealWear';

/** Where the disc's radial gradient is centred and how far it reaches, in view box units. */
const GLOW = { cx: 10 + 0.38 * 80, cy: 10 + 0.32 * 80, r: 0.75 * 80 };

/**
 * The engraved stadium stamp seal, ported from `seal()` in `design/reference.html`
 * (SPEC.md 8.3). Geometry is copied verbatim, including the ring radii, the two dashed
 * rings, the 0.47 shape scale and the baseline rule under it.
 *
 * The reference builds unique gradient and path ids with a counter. `useId` does the same
 * job here and is safe under concurrent rendering, where a module-level counter is not.
 *
 * Three things go beyond the reference, all opt-in, so a crisp brass or silver seal is
 * node for node what it was (`__tests__/Seal.test.tsx` holds the snapshot that proves it):
 *
 * - `metal` also takes a team tint. See `tintColors` for how any team colour stays legible.
 * - `wear` ages the strike, from a seed, so a stadium wears the same way everywhere.
 * - `metal="gold"` adds a diagonal foil band, and a slow glint across it unless Reduce
 *   Motion is on or `still` is set.
 */
export function Seal({
  ring,
  shapeKey,
  metal,
  size = 78,
  inkColor,
  wear = 0,
  seed,
  still = false,
}: {
  ring: string;
  shapeKey: string;
  metal: SealMetal;
  size?: number;
  /** The reference strokes the outer dashed rule in `--ink`, so it follows the theme
   *  while the seal's metal does not. A tinted or golden seal brings its own. */
  inkColor: string;
  /** 0 crisp, 1 lightly worn, 2 heavily worn. */
  wear?: WearLevel;
  /** What the wear is worked out from. The venue id; the ring text stands in without one. */
  seed?: string;
  /** Hold the golden glint still, for a seal too small to carry it or a card being captured. */
  still?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const gradientId = `sg${uid}`;
  const ringPathId = `sr${uid}`;
  const foilId = `sf${uid}`;
  const colors = useMemo(() => sealColors(metal, inkColor), [metal, inkColor]);
  const marks = useMemo(
    () => wearMarks(seed ?? `${ring}|${shapeKey}`, wear),
    [seed, ring, shapeKey, wear],
  );
  const { highlight, base, engraving, rim, detail } = colors;
  const gold = metal === 'gold';
  const ghost = marks.ghost;

  const ringText = (
    <Text
      fontSize="6.4"
      fontFamily={fontFamily({ weight: 800 })}
      fill={engraving}
      letterSpacing="0.5"
      stroke={marks.textBleed ? engraving : undefined}
      strokeWidth={marks.textBleed || undefined}
      strokeLinejoin={marks.textBleed ? 'round' : undefined}
    >
      <TextPath href={`#${ringPathId}`} startOffset="50%" textAnchor="middle">
        {ring}
      </TextPath>
    </Text>
  );

  const svg = (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={gradientId} cx="38%" cy="32%" r="75%">
          <Stop offset="0" stopColor={highlight} />
          <Stop offset="1" stopColor={base} />
        </RadialGradient>
        <Path id={ringPathId} d="M22 50a28 28 0 0 1 56 0" />
        {gold ? (
          <LinearGradient id={foilId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.6" />
            <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        ) : null}
      </Defs>

      {/* Outer dashed rule, in --ink. */}
      <Circle
        cx="50"
        cy="50"
        r="47"
        fill="none"
        stroke={colors.ring ?? inkColor}
        strokeWidth="1.3"
        strokeDasharray="3 2.6"
      />
      <Circle
        cx="50"
        cy="50"
        r="40"
        fill={`url(#${gradientId})`}
        stroke={rim}
        strokeWidth={String(1.4 + marks.swell)}
      />
      {gold ? <Circle cx="50" cy="50" r="39.3" fill={`url(#${foilId})`} /> : null}

      {/* The second strike, a few degrees off. Its rim runs past the disc onto the page. */}
      {ghost ? (
        <G
          opacity={ghost.opacity}
          transform={`translate(${ghost.dx} ${ghost.dy}) rotate(${ghost.rotate} 50 50)`}
        >
          <Circle cx="50" cy="50" r="40" fill="none" stroke={rim} strokeWidth="1.4" />
          <Circle cx="50" cy="50" r="36" fill="none" stroke={engraving} strokeWidth="0.8" />
          {ringText}
        </G>
      ) : null}

      <Circle
        cx="50"
        cy="50"
        r="36"
        fill="none"
        stroke={engraving}
        strokeWidth={String(0.8 + marks.swell * 0.6)}
      />
      <Circle
        cx="50"
        cy="50"
        r="24"
        fill="none"
        stroke={detail}
        strokeWidth="2.5"
        strokeDasharray="0.8 2.2"
        opacity="0.55"
      />

      {ringText}

      <G fill="none" stroke={engraving} strokeWidth={3 + marks.swell} color={engraving}>
        <StadiumShape shapeKey={shapeKey} transform="translate(35 36) scale(.47)" />
      </G>

      <Path d="M40 72h20" stroke={engraving} strokeWidth="1" />
      <Circle cx="36" cy="72" r="1" fill={engraving} />
      <Circle cx="64" cy="72" r="1" fill={engraving} />

      {/* Pooled ink on the rim, then the gaps where none took: each gap is the colour the
          disc has at that spot, so it reads as a hole in the engraving and not as a dot. */}
      {marks.blots.map((b, i) => (
        <Circle key={`b${i}`} cx={b.cx} cy={b.cy} r={b.r} fill={rim} opacity="0.9" />
      ))}
      {marks.specks.map((s, i) => (
        <Circle
          key={`k${i}`}
          cx={s.cx}
          cy={s.cy}
          r={s.r}
          fill={mix(highlight, base, Math.hypot(s.cx - GLOW.cx, s.cy - GLOW.cy) / GLOW.r)}
        />
      ))}
    </Svg>
  );

  if (!gold) return svg;
  return (
    <View style={{ width: size, height: size }}>
      {svg}
      {still ? null : <FoilGlint size={size} />}
    </View>
  );
}

/** One pass of the glint, in ms. Most of it is spent off the disc, so it reads as occasional. */
const GLINT_MS = 5200;

/**
 * A narrow band of light that crosses a golden seal now and then.
 *
 * Plain views over the SVG rather than an animated gradient: a transform is the one thing
 * Reanimated moves without touching the SVG tree, and the disc is a circle, so a round clip
 * is all the masking it needs. Under Reduce Motion nothing is mounted at all, and the still
 * foil band drawn in the SVG is the whole effect.
 */
function FoilGlint({ size }: { size: number }) {
  const reduceMotion = useReducedMotion();
  const disc = size * 0.78;
  const travel = disc * 1.5;
  const x = useSharedValue(-travel);

  React.useEffect(() => {
    if (reduceMotion) return;
    x.value = -travel;
    x.value = withRepeat(
      withTiming(travel, { duration: GLINT_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [reduceMotion, travel, x]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { rotate: '24deg' }],
  }));

  if (reduceMotion) return null;
  const band = disc * 0.2;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: (size - disc) / 2,
        top: (size - disc) / 2,
        width: disc,
        height: disc,
        borderRadius: disc / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View style={[{ flexDirection: 'row', height: disc * 1.6 }, style]}>
        <View style={{ width: band / 3, backgroundColor: 'rgba(255,255,255,0.10)' }} />
        <View style={{ width: band / 3, backgroundColor: 'rgba(255,255,255,0.26)' }} />
        <View style={{ width: band / 3, backgroundColor: 'rgba(255,255,255,0.10)' }} />
      </Animated.View>
    </View>
  );
}
