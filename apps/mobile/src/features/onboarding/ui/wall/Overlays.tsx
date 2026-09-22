import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * The three layers between the wall and the copy, from `design/welcome-reference.html`:
 *
 * - `.scrim`: `linear-gradient(180deg, rgba(10,13,18,.05) 0%, .2 26%, .72 48%, .95 62%, #0A0D12 72%)`
 * - `.topfade`: 96px, `rgba(10,13,18,.8)` to clear, so the status bar stays legible. The
 *   reference draws it twice (two `.topfade` spans), so the app does too.
 * - `.vig`: `box-shadow: inset 0 0 70px 14px rgba(6,8,11,.55)`. There is no inset shadow in
 *   React Native; four edge gradients of the same reach stand in for it
 *   (design/PORTING_NOTES.md).
 *
 * All static, one SVG, never touched by an animation. Laid out over the area below the
 * status bar, which is the reference's whole frame; the bar itself gets a flat band above.
 */
const SCR = '#0A0D12';
const VIG = '#06080B';
/** The inset shadow reaches spread plus blur: 14 + 70. */
const VIG_REACH = 84;

export const Scrim = React.memo(function Scrim({ topInset }: { topInset: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* The status bar band, above the reference's frame: the top fade's darkest value,
          held flat, so the clock and battery read over whatever card is under them. */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: topInset,
          backgroundColor: 'rgba(10,13,18,0.8)',
        }}
      />
      <Svg width="100%" height="100%" style={{ position: 'absolute', top: topInset, left: 0, right: 0, bottom: 0 }}>
        <Defs>
          <LinearGradient id="wall-scrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={SCR} stopOpacity="0.05" />
            <Stop offset="0.26" stopColor={SCR} stopOpacity="0.2" />
            <Stop offset="0.48" stopColor={SCR} stopOpacity="0.72" />
            <Stop offset="0.62" stopColor={SCR} stopOpacity="0.95" />
            <Stop offset="0.72" stopColor={SCR} stopOpacity="1" />
            <Stop offset="1" stopColor={SCR} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="wall-topfade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={SCR} stopOpacity="0.8" />
            <Stop offset="1" stopColor={SCR} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="wall-vig-v" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={VIG} stopOpacity="0.55" />
            <Stop offset="1" stopColor={VIG} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="wall-vig-h" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={VIG} stopOpacity="0.55" />
            <Stop offset="1" stopColor={VIG} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#wall-scrim)" />
        <Rect x="0" y="0" width="100%" height="96" fill="url(#wall-topfade)" />
        <Rect x="0" y="0" width="100%" height="96" fill="url(#wall-topfade)" />
        <Rect x="0" y="0" width="100%" height={VIG_REACH} fill="url(#wall-vig-v)" />
        <Rect
          x="0"
          y="0"
          width="100%"
          height={VIG_REACH}
          fill="url(#wall-vig-v)"
          transform="scale(1 -1)"
          origin="0, 50%"
          // Flipped to the bottom edge: an SVG transform on a percent-height canvas has no
          // "bottom", so it is mirrored about the middle of the screen instead.
        />
        <Rect x="0" y="0" width={VIG_REACH} height="100%" fill="url(#wall-vig-h)" />
        <Rect
          x="0"
          y="0"
          width={VIG_REACH}
          height="100%"
          fill="url(#wall-vig-h)"
          transform="scale(-1 1)"
          origin="50%, 0"
        />
      </Svg>
    </View>
  );
});
