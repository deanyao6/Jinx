import React from 'react';
import { View } from 'react-native';

import { Seal } from '@/components/reference/Seal';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { GhostSeal } from './GhostSeal';

type Props = {
  /** Shape keys of the venues already visited, in any order. Only the first few are drawn. */
  visitedShapes: readonly string[];
  total: number;
  max?: number;
};

/**
 * A short run of small seals under a list's bar: one struck seal per venue visited, dashed
 * ghosts for what is left, and "+25" when the list is longer than the run.
 */
export function SealRow({ visitedShapes, total, max = 5 }: Props) {
  const theme = useTheme();
  const shown = Math.min(max, total);
  const struck = visitedShapes.slice(0, shown);
  const ghosts = Math.max(0, shown - struck.length);
  const more = total - shown;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
    >
      {struck.map((shapeKey, i) => (
        <Seal
          key={`s${i}`}
          ring=""
          shapeKey={shapeKey}
          metal="silver"
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
