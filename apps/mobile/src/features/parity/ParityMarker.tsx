import React from 'react';
import { View } from 'react-native';

import {
  MARKER_CELL_PT,
  MARKER_HEIGHT_PT,
  MARKER_SENTINEL,
  MARKER_TOP_PT,
  markerBits,
} from './marker';

/**
 * A strip of flat colour that tells the parity harness which screen rendered.
 *
 * It sits in the top safe-area band, which the harness crops away before diffing, so it
 * never appears in a comparison. It is only mounted under the /parity routes, which only
 * exist in development builds.
 */
export function ParityMarker({ screenId }: { screenId: string }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: MARKER_TOP_PT,
        left: 0,
        height: MARKER_HEIGHT_PT,
        flexDirection: 'row',
        zIndex: 9999,
      }}
    >
      <View style={{ width: MARKER_CELL_PT, height: '100%', backgroundColor: MARKER_SENTINEL }} />
      {markerBits(screenId).map((bit, i) => (
        <View
          key={i}
          style={{
            width: MARKER_CELL_PT,
            height: '100%',
            backgroundColor: bit ? '#FFFFFF' : '#000000',
          }}
        />
      ))}
    </View>
  );
}
