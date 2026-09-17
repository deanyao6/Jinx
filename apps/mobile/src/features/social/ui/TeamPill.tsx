import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { TeamTheme } from '@/theme/reference/TeamTheme';

function Pill({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.accent.fill,
        borderRadius: theme.radius.pill,
        paddingVertical: 6,
        paddingHorizontal: 12,
      }}
    >
      <Text variant="caption" weight={750} numberOfLines={1} style={{ color: theme.accent.onFill }}>
        {label}
      </Text>
    </View>
  );
}

/** A team's name on a pill filled in that team's own colour, whatever team is in scope around it. */
export function TeamPill({ teamId, label }: { teamId: string; label: string }) {
  return (
    <TeamTheme team={teamId}>
      <Pill label={label} />
    </TeamTheme>
  );
}
