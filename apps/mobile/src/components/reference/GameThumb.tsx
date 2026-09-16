import React, { useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useReferenceTheme } from '@/theme/reference/TeamTheme';

import { StadiumShape } from './StadiumShape';

/**
 * The game row thumbnail, ported from `thumb()` in `design/reference.html`.
 *
 * It is the venue's stadium art on a night-sky gradient, used until the user adds their
 * own photo from that game (SPEC.md 8.8.2). The gradient runs from a fixed dark blue to
 * the row's team fill, and the three dots are stars.
 */
export function GameThumb({ shapeKey, size = 42 }: { shapeKey: string; size?: number }) {
  const { team } = useReferenceTheme();
  const gradientId = `tg${useId().replace(/:/g, '')}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 42 42">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0E1424" />
          <Stop offset="1" stopColor={team.fill} />
        </LinearGradient>
      </Defs>
      <Rect width="42" height="42" fill={`url(#${gradientId})`} />
      <Circle cx="8" cy="8" r="1.2" fill="#FFF3C4" />
      <Circle cx="34" cy="7" r="1.2" fill="#FFF3C4" />
      <Circle cx="21" cy="5" r="1" fill="#FFF3C4" opacity="0.7" />
      <G fill="none" stroke="#fff" strokeWidth={3.4} color="#fff" opacity={0.9}>
        <StadiumShape shapeKey={shapeKey} transform="translate(9 11) scale(.37)" />
      </G>
    </Svg>
  );
}
