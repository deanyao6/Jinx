import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { CARD_META, CARD_TITLE, WALL, wallText } from '../styles';
import { CardShell } from './CardShell';
import { GradientFill } from './GradientFill';

/** `.game .glow`: a 78px disc at `right:-24px; top:-24px`, blurred 20px, at 75%. */
const GLOW = 78;
const GLOW_BLUR = 20;
const GLOW_INSET = -24;

/**
 * `.game`: a team-tinted card with a 4pt edge, a blurred corner glow and a W or L disc.
 *
 * The tint is `linear-gradient(135deg, color-mix(t 42%, transparent), rgba(255,255,255,.07))`.
 * The glow is a `filter: blur(20px)` in the reference; the app draws a radial gradient of the
 * same reach instead (design/PORTING_NOTES.md): a blur filter per card, twice per column, is
 * exactly the per-card effect the wall cannot afford on an older phone.
 */
export const GameCard = React.memo(function GameCard({
  id,
  title,
  venue,
  dateLabel,
  result,
  color,
}: {
  id: string;
  title: string;
  venue: string;
  dateLabel: string;
  result: 'W' | 'L';
  color: string;
}) {
  const glowSize = GLOW + GLOW_BLUR * 2;
  return (
    <CardShell style={{ paddingLeft: 14 }}>
      <GradientFill
        id={`g-${id}`}
        angle={135}
        stops={[
          { offset: 0, color, opacity: 0.42 },
          { offset: 1, color: WALL.white, opacity: 0.07 },
        ]}
      />
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: color }}
      />
      <Svg
        pointerEvents="none"
        width={glowSize}
        height={glowSize}
        style={{
          position: 'absolute',
          right: GLOW_INSET - GLOW_BLUR,
          top: GLOW_INSET - GLOW_BLUR,
          opacity: 0.75,
        }}
      >
        <Defs>
          <RadialGradient id={`glow-${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity="1" />
            <Stop offset="0.55" stopColor={color} stopOpacity="0.7" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={glowSize / 2} cy={glowSize / 2} r={glowSize / 2} fill={`url(#glow-${id})`} />
      </Svg>
      <Text allowFontScaling={false} style={[CARD_TITLE, { marginBottom: 2 }]}>
        {title}
      </Text>
      <Text allowFontScaling={false} style={CARD_META}>
        {venue}
        {'\n'}
        {dateLabel}
      </Text>
      {/* `.res`: 21px disc, `right:8px; bottom:8px`, 10px weight 900 on `#0B0E12`. */}
      <View
        style={{
          position: 'absolute',
          right: 8,
          bottom: 8,
          width: 21,
          height: 21,
          borderRadius: 10.5,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: result === 'W' ? WALL.good : WALL.bad,
        }}
      >
        <Text
          allowFontScaling={false}
          style={wallText({ size: 10, line: 12, weight: 900, color: WALL.onCta })}
        >
          {result}
        </Text>
      </View>
    </CardShell>
  );
});
