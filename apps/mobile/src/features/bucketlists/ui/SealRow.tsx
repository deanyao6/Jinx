import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { VenueSeal } from '@/features/passport/seals';
import { useTheme } from '@/theme/ThemeProvider';
import { GhostSeal } from './GhostSeal';

type Props = {
  /** The venues already visited, in any order, with their shapes. Only the first few are drawn. */
  visited: readonly { venueId: string; shapeKey: string }[];
  total: number;
  max?: number;
};

/**
 * A short run of small seals under a list's bar: one struck seal per venue visited, in its
 * team's colours, dashed
 * ghosts for what is left, and "+25" when the list is longer than the run.
 */
export function SealRow({ visited, total, max = 5 }: Props) {
  const theme = useTheme();
  const shown = Math.min(max, total);
  const struck = visited.slice(0, shown);
  const ghosts = Math.max(0, shown - struck.length);
  const more = total - shown;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
    >
      {struck.map((v) => (
        <VenueSeal
          key={v.venueId}
          venueId={v.venueId}
          ring=""
          shapeKey={v.shapeKey}
          size={34}
          inkColor={theme.colors.ink}
        />
      ))}
      {Array.from({ length: ghosts }, (_, i) => (
        <GhostSeal key={`g${i}`} size={34} />
      ))}
      {more > 0 ? (
        <Text variant="caption" color="muted" weight={600} style={{ marginLeft: 2 }}>
          +{more}
        </Text>
      ) : null}
    </View>
  );
}
