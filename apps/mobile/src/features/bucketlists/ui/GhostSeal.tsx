import React from 'react';
import Svg, { Circle, G } from 'react-native-svg';

import { StadiumShape } from '@/components/reference/StadiumShape';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * A stamp not earned yet: the seal's outer dashed rule with nothing struck inside it, and the
 * stadium's outline faintly where the engraving will go. Pass no `shapeKey` for a bare ring.
 */
export function GhostSeal({ size = 78, shapeKey }: { size?: number; shapeKey?: string | null }) {
  const theme = useTheme();
  const stroke = theme.colors.muted;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke={stroke}
        strokeWidth={size < 50 ? 3.2 : 1.6}
        strokeDasharray={size < 50 ? '7 6' : '4 3.4'}
        opacity={0.55}
      />
      {shapeKey ? (
        <G fill="none" stroke={stroke} strokeWidth={2.6} color={stroke} opacity={0.4}>
          <StadiumShape shapeKey={shapeKey} transform="translate(29 30) scale(.66)" />
        </G>
      ) : null}
    </Svg>
  );
}
