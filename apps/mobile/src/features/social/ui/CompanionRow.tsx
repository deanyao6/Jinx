import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { PersonAvatar } from '@/components/PersonAvatar';
import { ICONS } from '@/components/reference/icons';
import { Text } from '@/components/Text';
import { CHARM_LABEL, JINX_LABEL, type CompanionLuck } from '@/features/eggs/jinx';
import { JinxBadge } from '@/features/eggs/JinxBadge';
import { ShareButton } from '@/features/share/ShareButton';
import { useTheme } from '@/theme/ThemeProvider';
import { gamesLabel, recordText, recordTone } from '../copy';

type Props = {
  /** A stable id for the person (their account, else the placeholder's id): seeds the avatar. */
  personId?: string | null;
  /** The linked account's `avatar_path`. A placeholder ("Dad") has none. */
  avatarPath?: string | null;
  name: string;
  subtitle?: string | null;
  wins: number;
  losses: number;
  ties: number;
  games: number;
  linked?: boolean;
  /**
   * The certified jinx egg (`features/eggs/jinx`): a cat on the avatar, or the quieter spark.
   * Only ever passed for the signed-in person's own records. Absent draws the row as it was.
   */
  luck?: CompanionLuck | null;
  first?: boolean;
  onPress?: () => void;
  /** Share icon after the record (companion record card). */
  onShare?: () => void;
};

/** One line of the "Your record with" list from the mockup: avatar, name, games, colored record. */
export function CompanionRow({
  personId,
  avatarPath,
  name,
  subtitle,
  wins,
  losses,
  ties,
  games,
  linked,
  luck,
  first,
  onPress,
  onShare,
}: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const tone = recordTone(wins, losses);
  const color = tone === 'good' ? 'green' : tone === 'bad' ? 'red' : 'ink';
  const luckLabel = luck === 'jinx' ? JINX_LABEL : luck === 'charm' ? CHARM_LABEL : null;
  const Spark = ICONS['i-spark'];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${luckLabel ? `${luckLabel}, ` : ''}${gamesLabel(games)}, record ${recordText(wins, losses, ties)}`}
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
      <View>
        <PersonAvatar userId={personId} name={name} path={avatarPath} size={38} />
        {luck === 'jinx' ? <JinxBadge size={16} ringColor={c.card} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {name}
          </Text>
          {linked ? <Ionicons name="link" size={13} color={c.muted} /> : null}
        </View>
        {luckLabel ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {luck === 'charm' ? <Spark size={13} color={theme.accent.text} /> : null}
            <Text variant="caption" weight={750} numberOfLines={1}>
              {luckLabel}
            </Text>
          </View>
        ) : null}
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
