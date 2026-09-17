import React from 'react';
import { View } from 'react-native';
import Svg, { G } from 'react-native-svg';

import { Seal } from '@/components/reference/Seal';
import { SHAPE_VIEWBOX } from '@/components/reference/shapes';
import { StadiumShape } from '@/components/reference/StadiumShape';
import { alpha } from '@/theme/color';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Three engraved seals, stamped a little askew the way they land in a real passport, so the first
 * screen already shows what Jinx collects. The rings carry the promise rather than a stadium's
 * name, and the shapes are one of each family so neither sport owns the page.
 */
export function WelcomeSeals() {
  const theme = useTheme();
  const ink = theme.colors.ink;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Three stadium stamps"
      style={{ flexDirection: 'row', alignItems: 'flex-end', height: 112 }}
    >
      <View style={{ transform: [{ rotate: '-11deg' }] }}>
        <Seal ring="EVERY GAME" shapeKey="bowl" metal="silver" size={84} inkColor={ink} />
      </View>
      <View style={{ marginLeft: -14, marginBottom: 6, transform: [{ rotate: '4deg' }] }}>
        <Seal ring="EVERY STADIUM" shapeKey="ballparkA" metal="brass" size={104} inkColor={ink} />
      </View>
      <View style={{ marginLeft: -12, transform: [{ rotate: '13deg' }] }}>
        <Seal ring="YOUR RECORD" shapeKey="canopy" metal="silver" size={76} inkColor={ink} />
      </View>
    </View>
  );
}

/**
 * A stadium outline as a faint watermark behind the page, bleeding off the top right corner,
 * like the ghost shape in the Passport's hero. Decoration only: hidden from the screen reader.
 */
export function StadiumWatermark({ size = 380 }: { size?: number }) {
  const theme = useTheme();
  const color = alpha(theme.colors.ink, theme.scheme === 'dark' ? 0.07 : 0.05);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: -size * 0.12, right: -size * 0.42 }}
    >
      <Svg width={size} height={size} viewBox={SHAPE_VIEWBOX}>
        <G fill="none" stroke={color} strokeWidth={1.1} color={color}>
          <StadiumShape shapeKey="colonnade" />
        </G>
      </Svg>
    </View>
  );
}
