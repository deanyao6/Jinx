import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { AVATARS } from '@/features/demo/fixtures';

/**
 * The generated default avatar, ported from `avatar()` in `design/reference.html`
 * (SPEC.md 8.6). It stands in until a user uploads a profile photo.
 *
 * Geometry is copied verbatim, including the 40x40 viewBox and the shoulder path that
 * deliberately extends past it to y=42 so the shoulders are cropped by the circle.
 */
export function Avatar({ name, size = 20 }: { name: string; size?: number }) {
  const palette = AVATARS[name] ?? AVATARS.dean;
  if (!palette) return null;
  const [skin, hair, background] = palette;

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Rect width="40" height="40" fill={background} />
      <Path d="M6 42c1-9 7-13 14-13s13 4 14 13z" fill={hair} opacity="0.85" />
      <Circle cx="20" cy="17" r="8" fill={skin} />
      <Path d="M12 16c0-6 4-9 8-9s8 3 8 9c-2-3-5-4-8-4s-6 1-8 4z" fill={hair} />
    </Svg>
  );
}
