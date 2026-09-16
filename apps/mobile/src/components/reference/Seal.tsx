import React, { useId } from 'react';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop, Text, TextPath } from 'react-native-svg';

import { METAL } from '@/features/demo/fixtures';
import { fontFamily } from '@/theme/fonts';

import { StadiumShape } from './StadiumShape';

/**
 * The engraved stadium stamp seal, ported from `seal()` in `design/reference.html`
 * (SPEC.md 8.3). Geometry is copied verbatim, including the ring radii, the two dashed
 * rings, the 0.47 shape scale and the baseline rule under it.
 *
 * The reference builds unique gradient and path ids with a counter. `useId` does the same
 * job here and is safe under concurrent rendering, where a module-level counter is not.
 */
export function Seal({
  ring,
  shapeKey,
  metal,
  size = 78,
  inkColor,
}: {
  ring: string;
  shapeKey: string;
  metal: 'brass' | 'silver';
  size?: number;
  /** The reference strokes the outer dashed rule in `--ink`, so it follows the theme
   *  while the seal's metal does not. */
  inkColor: string;
}) {
  const uid = useId().replace(/:/g, '');
  const gradientId = `sg${uid}`;
  const ringPathId = `sr${uid}`;
  const [highlight, base, engraving] = METAL[metal];

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={gradientId} cx="38%" cy="32%" r="75%">
          <Stop offset="0" stopColor={highlight} />
          <Stop offset="1" stopColor={base} />
        </RadialGradient>
        <Path id={ringPathId} d="M22 50a28 28 0 0 1 56 0" />
      </Defs>

      {/* Outer dashed rule, in --ink. */}
      <Circle
        cx="50"
        cy="50"
        r="47"
        fill="none"
        stroke={inkColor}
        strokeWidth="1.3"
        strokeDasharray="3 2.6"
      />
      <Circle
        cx="50"
        cy="50"
        r="40"
        fill={`url(#${gradientId})`}
        stroke={engraving}
        strokeWidth="1.4"
      />
      <Circle cx="50" cy="50" r="36" fill="none" stroke={engraving} strokeWidth="0.8" />
      <Circle
        cx="50"
        cy="50"
        r="24"
        fill="none"
        stroke={engraving}
        strokeWidth="2.5"
        strokeDasharray="0.8 2.2"
        opacity="0.55"
      />

      <Text
        fontSize="6.4"
        fontFamily={fontFamily({ weight: 800 })}
        fill={engraving}
        letterSpacing="0.5"
      >
        <TextPath href={`#${ringPathId}`} startOffset="50%" textAnchor="middle">
          {ring}
        </TextPath>
      </Text>

      <G fill="none" stroke={engraving} strokeWidth={3} color={engraving}>
        <StadiumShape shapeKey={shapeKey} transform="translate(35 36) scale(.47)" />
      </G>

      <Path d="M40 72h20" stroke={engraving} strokeWidth="1" />
      <Circle cx="36" cy="72" r="1" fill={engraving} />
      <Circle cx="64" cy="72" r="1" fill={engraving} />
    </Svg>
  );
}
