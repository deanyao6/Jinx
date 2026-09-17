import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * The certified jinx's black cat (`./jinx`). Drawn here because the reference icon set is
 * generated from `design/reference.html` and has no cat; the geometry follows that set: a 24
 * box, round caps and joins, and the tail at the set's 1.9 stroke.
 *
 * The badge is pinned to one scheme on purpose. A black cat has to be black, so it sits on a
 * pale chip in light and dark alike, and the ring around the chip is the colour of whatever is
 * behind the avatar, which is what makes it read as a status badge rather than a sticker.
 */
const CAT = '#14161A';
const CHIP = '#F4F1EA';

/** A seated cat seen from behind, tail curled to the right. */
export function JinxCat({ size = 16, color = CAT }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6.2 8.2 6.4 3.2 9 5.3a4.6 4.6 0 0 1 2.4 0L14 3.2l.2 5a4.1 4.1 0 0 1-1.5 3.4c2.3 1.6 3.3 4.9 3 9.4H5.3c-.3-4.5.7-7.8 3-9.4A4.1 4.1 0 0 1 6.2 8.2z"
        fill={color}
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Path
        d="M15.5 20.8c3 .3 4.8-1.2 4.5-3.8-.2-1.7-1.7-2.3-2.7-1.3"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * The cat as a status badge at the bottom right of an avatar. The parent is the avatar's own
 * wrapper (`position: 'relative'` is the React Native default), so this only places itself.
 */
export function JinxBadge({
  size = 16,
  ringColor,
  inset = -3,
}: {
  /** Diameter of the chip, ring included. 14 to 16 on a list row. */
  size?: number;
  /** The surface behind the avatar. */
  ringColor: string;
  /** How far the badge hangs outside the avatar's box. */
  inset?: number;
}) {
  return (
    <View
      testID="jinx-badge"
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        right: inset,
        bottom: inset,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: CHIP,
        borderWidth: 1.5,
        borderColor: ringColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <JinxCat size={size - 5} />
    </View>
  );
}
