import React from 'react';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';

import { AVATARS, PHOTO_SKIES } from '@/features/demo/fixtures';
import { fontFamily } from '@/theme/fonts';

/**
 * The placeholder photos on Relive, ported from `scene()` in `design/reference.html`.
 *
 * They stand in for real uploads in demo mode (SPEC.md 8.9). Geometry is verbatim,
 * including the sky colour chosen by `seed % 3`.
 */
export function PhotoScene({ kind, seed }: { kind: 'selfie' | 'field' | 'board'; seed: number }) {
  const sky = PHOTO_SKIES[seed % 3] ?? PHOTO_SKIES[0];

  if (kind === 'selfie') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 90 90">
        <Rect width="90" height="90" fill={sky} />
        <Path d="M0 62h90v28H0z" fill="#2E7D4F" />
        <Circle cx="12" cy="14" r="2" fill="#FFF6C8" />
        <Circle cx="78" cy="10" r="2" fill="#FFF6C8" />
        <AvatarRaw name="dean" transform="translate(8 26) scale(1.05)" />
        <AvatarRaw name="dad" transform="translate(44 30) scale(.95)" />
      </Svg>
    );
  }

  if (kind === 'field') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 90 90">
        <Rect width="90" height="90" fill={sky} />
        <Path d="M0 40h90v50H0z" fill="#2E7D4F" />
        <Path d="M45 84 18 57l27-17 27 17z" fill="#C49A6C" />
        <Path d="M45 76 30 61l15-10 15 10z" fill="#3A8D5C" />
        <Path d="M8 40V18M82 40V18" stroke="#DDE3EA" strokeWidth="2" />
        <Rect x="3" y="12" width="10" height="6" fill="#FFF6C8" />
        <Rect x="77" y="12" width="10" height="6" fill="#FFF6C8" />
      </Svg>
    );
  }

  return (
    <Svg width="100%" height="100%" viewBox="0 0 90 90">
      <Rect width="90" height="90" fill="#101418" />
      <Rect x="10" y="16" width="70" height="44" rx="4" fill="#1C232B" stroke="#3A444F" />
      <SvgText
        x="45"
        y="45"
        textAnchor="middle"
        fontFamily={fontFamily({ weight: 900 })}
        fontSize="20"
        fill="#FFD166"
      >
        6 – 3
      </SvgText>
      <Path d="M0 70h90v20H0z" fill="#2B2F36" />
    </Svg>
  );
}

/** `avatarRaw()`: the avatar without its own <svg>, for placing inside a scene. */
function AvatarRaw({ name, transform }: { name: string; transform: string }) {
  const palette = AVATARS[name] ?? AVATARS.dean;
  if (!palette) return null;
  const [skin, hair, background] = palette;
  return (
    <>
      <Rect width="40" height="40" rx="20" fill={background} transform={transform} />
      <Circle cx="20" cy="17" r="8" fill={skin} transform={transform} />
      <Path
        d="M12 16c0-6 4-9 8-9s8 3 8 9c-2-3-5-4-8-4s-6 1-8 4z"
        fill={hair}
        transform={transform}
      />
      <Path d="M8 40c1-7 6-10 12-10s11 3 12 10z" fill={hair} transform={transform} />
    </>
  );
}
