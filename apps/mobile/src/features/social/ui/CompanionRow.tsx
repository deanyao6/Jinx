import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { ShareButton } from '@/features/share/ShareButton';
import { useTheme } from '@/theme/ThemeProvider';
import { gamesLabel, recordText, recordTone } from '../copy';
import { Avatar } from './Avatar';

type Props = {
  name: string;
  subtitle?: string | null;
  wins: number;
  losses: number;
  ties: number;
  games: number;
  linked?: boolean;
  first?: boolean;
  onPress?: () => void;
  /** Share icon after the record (companion record card). */
  onShare?: () => void;
};

/** One line of the "Your record with" list from the mockup: avatar, name, games, colored record. */
export function CompanionRow({
  name,
  subtitle,
  wins,
  losses,
  ties,
  games,
  linked,
  first,
  onPress,
  onShare,
}: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const tone = recordTone(wins, losses);
  const color = tone === 'good' ? 'green' : tone === 'bad' ? 'red' : 'ink';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${gamesLabel(games)}, record ${recordText(wins, losses, ties)}`}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.line,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Avatar name={name} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {name}
          </Text>
          {linked ? <Ionicons name="link" size={13} color={c.muted} /> : null}
        </View>
        <Text variant="caption" color="muted" numberOfLines={1}>
          {subtitle ?? gamesLabel(games)}
        </Text>
      </View>
      <Text variant="stat" color={color} style={{ fontVariant: ['tabular-nums'] }}>
        {recordText(wins, losses, ties)}
      </Text>
      {onShare ? (
        <ShareButton label={`Share record with ${name}`} size={30} onPress={onShare} />
      ) : null}
    </Pressable>
  );
}
