import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';

type Props = {
  /** 1-based place in the list, or null when the list is a search result and has no places. */
  rank: number | null;
  name: string;
  subtitle: string;
  seen: number;
  /** The podium: the rank and the count take the team colour. */
  accent?: boolean;
};

/** One line of the players seen ranking: place, who, and how many times, in condensed type. */
export function PlayerRankRow({ rank, name, subtitle, seen, accent = false }: Props) {
  return (
    <View
      accessible
      accessibilityLabel={`${rank ? `${rank}. ` : ''}${name}, ${subtitle}, ${seen} ${seen === 1 ? 'time' : 'times'}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 }}
    >
      {rank ? (
        <Text
          variant="stat"
          color={accent ? 'accent' : 'muted'}
          align="center"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ width: 34, fontSize: accent ? 26 : 20, lineHeight: 28 }}
        >
          {rank}
        </Text>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" color="muted" numberOfLines={1} style={{ marginTop: 1 }}>
          {subtitle}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          variant="stat"
          color={accent ? 'accent' : 'ink'}
          style={{ fontSize: 24, lineHeight: 26, fontVariant: ['tabular-nums'] }}
        >
          {seen}
        </Text>
        <Text variant="kicker" color="muted" style={{ fontSize: 9.5, lineHeight: 12 }}>
          {seen === 1 ? 'time' : 'times'}
        </Text>
      </View>
    </View>
  );
}
