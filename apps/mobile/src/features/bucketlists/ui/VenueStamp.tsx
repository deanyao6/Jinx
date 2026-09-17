import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { VenueSeal } from '@/features/passport/seals';
import { useTheme } from '@/theme/ThemeProvider';
import { GhostSeal } from './GhostSeal';

type Props = {
  venueId: string;
  name: string;
  place: string;
  /** "Closed 2008", for a venue that is gone. */
  note?: string | null;
  shapeKey: string;
  visited: boolean;
};

/**
 * One venue on a bucket list, a third of a row wide. Visited is the Passport's struck seal;
 * not yet is a quiet dashed ghost of it with the text dimmed.
 */
export function VenueStamp({ venueId, name, place, note, shapeKey, visited }: Props) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityRole="checkbox"
      accessibilityState={{ checked: visited }}
      accessibilityLabel={name}
      style={{ width: '33.33%', alignItems: 'center', paddingHorizontal: 4, marginBottom: 16 }}
    >
      <View style={{ marginBottom: 6 }}>
        {visited ? (
          <VenueSeal
            venueId={venueId}
            ring={name.toUpperCase()}
            shapeKey={shapeKey}
            size={78}
            inkColor={theme.colors.ink}
          />
        ) : (
          <GhostSeal size={78} shapeKey={shapeKey} />
        )}
      </View>
      <Text
        variant="caption"
        weight={750}
        color={visited ? 'ink' : 'muted'}
        align="center"
        numberOfLines={2}
      >
        {name}
      </Text>
      {place ? (
        <Text variant="label" color="muted" align="center" numberOfLines={1}>
          {place}
        </Text>
      ) : null}
      {note ? (
        <Text variant="label" color="muted" align="center" numberOfLines={1}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}
