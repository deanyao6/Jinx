import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  /** Small capitals above the number, in the team colour. */
  kicker?: string | null;
  /** The number the page opens on, already formatted. */
  value: string;
  /** What the number counts: "stadiums", "players seen". Capitals come from the variant. */
  unit: string;
  body?: string | null;
};

/**
 * The top of a "View all" page: the count in the team colour at display size, with its unit
 * beside it in the page title's voice. The navigator header already names the page, so this
 * says how many rather than repeating the name.
 */
export function CountHero({ kicker, value, unit, body }: Props) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${value} ${unit}`}
      style={{ marginBottom: theme.spacing.lg, gap: 4 }}
    >
      {kicker ? (
        <Text variant="kicker" color="accent">
          {kicker}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
        <Text
          variant="display"
          color="accent"
          style={{ lineHeight: 64, fontVariant: ['tabular-nums'] }}
        >
          {value}
        </Text>
        <Text variant="h1">{unit}</Text>
      </View>
      {body ? (
        <Text variant="sub" color="muted" style={{ marginTop: 2 }}>
          {body}
        </Text>
      ) : null}
    </View>
  );
}
