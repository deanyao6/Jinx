import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { LiveDot } from '@/components/reference/LiveDot';
import { StadiumShape } from '@/components/reference/StadiumShape';

import { GHOST, LIVE, PLEDGE, STREAK, WRAPPED } from '../fixtures';
import { CARD_META, CARD_TITLE, WALL, wallText } from '../styles';
import { CardShell } from './CardShell';
import { GradientFill } from './GradientFill';

/**
 * The one-off cards: a companion record, a pledge, the live game, the streak, the ghost stamp
 * and the Wrapped card. Each is its reference rule, line for line.
 */

/** `.buddy`: a 26px avatar disc, name over a line, the record at the far right. */
export const BuddyCard = React.memo(function BuddyCard({
  name,
  line,
  record,
  color,
  tone,
}: {
  name: string;
  line: string;
  record: string;
  color: string;
  tone: 'good' | 'bad';
}) {
  return (
    <CardShell style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: color }} />
      <View>
        <Text allowFontScaling={false} style={CARD_TITLE}>
          {name}
        </Text>
        <Text allowFontScaling={false} style={CARD_META}>
          {line}
        </Text>
      </View>
      <Text
        allowFontScaling={false}
        style={[
          wallText({
            size: 14,
            line: 18.2,
            width: 70,
            weight: 900,
            color: tone === 'good' ? WALL.good : WALL.bad,
          }),
          { marginLeft: 'auto' },
        ]}
      >
        {record}
      </Text>
    </CardShell>
  );
});

/** `.pledge`: NEUTRAL GAME, who was backed, the odds, and the delta in gold. */
export const PledgeCard = React.memo(function PledgeCard({
  team,
  odds,
  delta,
}: {
  team: string;
  odds: string;
  delta: string;
}) {
  return (
    <CardShell>
      <Text allowFontScaling={false} style={CARD_META}>
        {PLEDGE.tag}
      </Text>
      <Text allowFontScaling={false} style={[CARD_TITLE, { marginBottom: 2 }]}>
        {PLEDGE.prefix}
        {team}
      </Text>
      <Text allowFontScaling={false} style={CARD_META}>
        at {odds}
        {PLEDGE.suffix}
      </Text>
      <Text
        allowFontScaling={false}
        style={wallText({ size: 15, line: 19.5, width: 70, weight: 900, color: WALL.gold })}
      >
        {delta}
      </Text>
    </CardShell>
  );
});

/** `.live`: a red-edged card with the pulsing dot. `pulse 1.5s` to 25%, still when asked. */
export const LiveCard = React.memo(function LiveCard({ still }: { still: boolean }) {
  return (
    <CardShell style={{ borderColor: 'rgba(255,106,96,0.45)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ marginRight: 5, marginTop: 1 }}>
          <LiveDot color={WALL.bad} size={6} durationMs={1500} low={0.25} still={still} />
        </View>
        <Text allowFontScaling={false} style={CARD_META}>
          {LIVE.status}
        </Text>
      </View>
      <Text allowFontScaling={false} style={[CARD_TITLE, { marginBottom: 2 }]}>
        {LIVE.line}
      </Text>
      <Text allowFontScaling={false} style={CARD_META}>
        {LIVE.sub}
      </Text>
    </CardShell>
  );
});

/** `.streak`: a green wash, and W W W W in spaced capitals. */
export const StreakCard = React.memo(function StreakCard({ id }: { id: string }) {
  return (
    <CardShell style={{ borderColor: 'rgba(60,203,127,0.45)' }}>
      <GradientFill
        id={`s-${id}`}
        angle={140}
        stops={[
          { offset: 0, color: WALL.good, opacity: 0.3 },
          { offset: 1, color: WALL.white, opacity: 0.06 },
        ]}
      />
      <Text allowFontScaling={false} style={CARD_META}>
        {STREAK.tag}
      </Text>
      <Text allowFontScaling={false} style={[CARD_TITLE, { marginBottom: 2 }]}>
        {STREAK.line}
      </Text>
      <Text allowFontScaling={false} style={CARD_META}>
        {STREAK.sub}
      </Text>
      <Text
        allowFontScaling={false}
        style={[
          wallText({ size: 13, line: 16.9, weight: 900, color: WALL.good, spacing: 2.86 }),
          { marginTop: 6 },
        ]}
      >
        {STREAK.marks}
      </Text>
    </CardShell>
  );
});

/**
 * `.ghost`: a stamp not yet earned. Two dashed rings and the stadium's outline in 70% white
 * at 55%, the name, and STAMP NOT YET EARNED. Its geometry is the welcome reference's own
 * (`ghostCard()`), which differs from `features/bucketlists/ui/GhostSeal.tsx` in both rings
 * and its scale, so the shared shape is reused and the rings are drawn here.
 */
export const GhostStampCard = React.memo(function GhostStampCard({
  name,
  shape,
}: {
  name: string;
  shape: string;
}) {
  const stroke = 'rgba(255,255,255,0.7)';
  return (
    <CardShell
      style={{
        paddingVertical: 10,
        paddingHorizontal: 0,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
      }}
    >
      <Svg width={74} height={74} viewBox="0 0 100 100" opacity={0.55}>
        <G fill="none" stroke={stroke} strokeWidth={1.6}>
          <Circle cx="50" cy="50" r="46" strokeDasharray="4 4" />
          <Circle cx="50" cy="50" r="38" strokeDasharray="2 4" opacity={0.7} />
          <G strokeWidth={3.4} color={stroke}>
            <StadiumShape shapeKey={shape} transform="translate(35 36) scale(.47)" />
          </G>
        </G>
      </Svg>
      <Text
        allowFontScaling={false}
        style={wallText({ size: 11, line: 14.3, weight: 800, color: 'rgba(255,255,255,0.82)' })}
      >
        {name}
      </Text>
      <Text
        allowFontScaling={false}
        style={[
          wallText({
            size: 8.5,
            line: 11.05,
            weight: 800,
            color: 'rgba(255,255,255,0.5)',
            spacing: 1.36,
          }),
          { marginTop: 6, textAlign: 'center' },
        ]}
      >
        {GHOST.caption}
      </Text>
    </CardShell>
  );
});

/** `.wrapped`: `linear-gradient(150deg, #3B1F63, #12172B)` under SEASON WRAPPED and the year. */
export const WrappedCard = React.memo(function WrappedCard({ id }: { id: string }) {
  return (
    <CardShell style={{ borderColor: 'rgba(255,255,255,0.14)' }}>
      <GradientFill
        id={`w-${id}`}
        angle={150}
        stops={[
          { offset: 0, color: '#3B1F63' },
          { offset: 1, color: '#12172B' },
        ]}
      />
      <Text allowFontScaling={false} style={CARD_META}>
        {WRAPPED.tag}
      </Text>
      <Text allowFontScaling={false} style={wallText({ size: 22, line: 22, width: 62, weight: 900 })}>
        {WRAPPED.year}
      </Text>
      <Text allowFontScaling={false} style={CARD_META}>
        {WRAPPED.sub}
      </Text>
    </CardShell>
  );
});
