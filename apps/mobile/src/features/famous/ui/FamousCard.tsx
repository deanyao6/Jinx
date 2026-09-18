import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/Card';
import { IconTile } from '@/components/IconTile';
import { Text } from '@/components/Text';
import { SideTheme } from '@/features/games/ui/SideTheme';
import { useTheme } from '@/theme/ThemeProvider';
import { famousKicker, famousStory, famousTitle, type FamousItem } from '../format';

type Props = {
  items: readonly FamousItem[];
  sportId: string;
  /** Whose colours a league-wide entry takes: the home side. */
  homeTeamId: string | null;
};

/**
 * The badge on a game page, under the scoreboard: a gold tile, the title and the story, in the
 * colours of the team the entry is about (the home side's for a league-wide one). A personal
 * badge says "Yours" and, tapped, says why it counts, without claiming more than the data can.
 */
export function FamousCard({ items, sportId, homeTeamId }: Props) {
  if (items.length === 0) return null;
  return (
    <View testID="famous-card">
      {items.map((raw, i) => {
        const item = { ...raw, sportId: raw.sportId || sportId };
        return (
          <SideTheme key={`${item.source}:${item.kind}:${item.playerName ?? ''}:${i}`} team={item.teamId ?? homeTeamId}>
            <FamousEntry item={item} />
          </SideTheme>
        );
      })}
    </View>
  );
}

function FamousEntry({ item }: { item: FamousItem }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const title = famousTitle(item);
  const story = famousStory(item);
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <IconTile icon="i-spark" gold solid size={42} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="kicker" color="accent">
          {famousKicker(item)}
        </Text>
        <Text variant="h2" style={{ marginTop: 2 }}>
          {title}
        </Text>
        {!item.personal && story ? (
          <Text variant="sub" color="muted" style={{ marginTop: theme.spacing.xs }}>
            {story}
          </Text>
        ) : null}
        {item.personal && open ? (
          <Text variant="sub" color="muted" style={{ marginTop: theme.spacing.xs }}>
            {story}
          </Text>
        ) : null}
      </View>
    </View>
  );
  return (
    <Card tone="accent">
      {item.personal ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${open ? 'Hide' : 'Show'} why this counts`}
          onPress={() => setOpen((v) => !v)}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
    </Card>
  );
}
