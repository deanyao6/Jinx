import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { STUB } from '../fixtures';
import { WALL, wallText } from '../styles';
import { CardShell } from './CardShell';

const INK = '#15171B';
const ADMIT = '#8A7A52';
const SEAT_LABEL = '#6B6553';
const PERF = '#C9BC98';

/**
 * `.stub`: a cream ticket stub. ADMIT ONE in spaced capitals, the team at 20px in the
 * narrowest cut, a dashed perforation, and section, row and seat along the bottom. Two
 * 12px discs in the screen colour, 34px from the top and half outside each side, are the
 * punched notches; the card's own clipping cuts them in half, as `overflow:hidden` does.
 */
export const StubCard = React.memo(function StubCard({
  team,
  sec,
  row,
  seat,
}: {
  team: string;
  sec: string;
  row: string;
  seat: string;
}) {
  return (
    <CardShell style={{ backgroundColor: WALL.cream, borderWidth: 0 }}>
      <Text
        allowFontScaling={false}
        style={wallText({ size: 8, line: 10.4, weight: 800, color: ADMIT, spacing: 1.6 })}
      >
        {STUB.admit}
      </Text>
      <Text
        allowFontScaling={false}
        style={[
          wallText({ size: 20, line: 20, width: 64, weight: 900, color: INK }),
          { marginVertical: 2 },
        ]}
      >
        {team}
      </Text>
      {/* `.perf`: `border-top:1.5px dashed #C9BC98; margin:7px 0 5px`. Drawn as a line: React
          Native's dashed border wants all four sides the same. */}
      <Svg height={1.5} width="100%" style={{ marginTop: 7, marginBottom: 5 }}>
        <Line x1="0" y1="0.75" x2="100%" y2="0.75" stroke={PERF} strokeWidth={1.5} strokeDasharray="4.5 4.5" />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <SeatCell label="SEC" value={sec} />
        <SeatCell label="ROW" value={row} />
        <SeatCell label="SEAT" value={seat} />
      </View>
      <Notch side="left" />
      <Notch side="right" />
    </CardShell>
  );
});

/** `.seat span`: "SEC" at 9px, then `b` at 12px weight 800, both on one line. */
function SeatCell({ label, value }: { label: string; value: string }) {
  return (
    <Text allowFontScaling={false} style={wallText({ size: 9, line: 15.6, color: SEAT_LABEL })}>
      {label}
      <Text style={wallText({ size: 12, line: 15.6, weight: 800, color: INK })}>{value}</Text>
    </Text>
  );
}

function Notch({ side }: { side: 'left' | 'right' }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 34,
        [side]: -6,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: WALL.scr,
      }}
    />
  );
}
