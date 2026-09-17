import React from 'react';
import { Pressable, View } from 'react-native';

import { IconTile } from '@/components/IconTile';
import { ICONS, type IconName } from '@/components/reference/icons';
import { Text } from '@/components/Text';
import { momentLabel } from '@/features/attendances/moments';
import { alpha } from '@/theme/color';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Every moment the detectors can find (`MomentType` in packages/core), with the sport it
 * belongs to and an icon from the reference set. `home_run` is left out because the stats
 * payload leaves it out: it is an event, not a trophy.
 */
const CATALOGUE: readonly { type: string; sport: 'mlb' | 'nfl'; icon: IconName }[] = [
  { type: 'walk_off', sport: 'mlb', icon: 'i-bolt' },
  { type: 'walk_off_home_run', sport: 'mlb', icon: 'i-bolt' },
  { type: 'grand_slam', sport: 'mlb', icon: 'i-spark' },
  { type: 'cycle', sport: 'mlb', icon: 'i-route' },
  { type: 'no_hitter', sport: 'mlb', icon: 'i-lock' },
  { type: 'perfect_game', sport: 'mlb', icon: 'i-verified' },
  { type: 'extra_innings', sport: 'mlb', icon: 'i-clock' },
  { type: 'shutout', sport: 'mlb', icon: 'i-lock' },
  { type: 'immaculate_inning', sport: 'mlb', icon: 'i-spark' },
  { type: 'overtime', sport: 'nfl', icon: 'i-clock' },
  { type: 'late_go_ahead_score', sport: 'nfl', icon: 'i-trend' },
  { type: 'walk_off_score', sport: 'nfl', icon: 'i-bolt' },
  { type: 'pick_six', sport: 'nfl', icon: 'i-swords' },
  { type: 'fumble_return_td', sport: 'nfl', icon: 'i-swords' },
  { type: 'kick_return_td', sport: 'nfl', icon: 'i-route' },
  { type: 'safety', sport: 'nfl', icon: 'i-flag' },
  { type: 'long_field_goal', sport: 'nfl', icon: 'i-target' },
  { type: 'comeback_14', sport: 'nfl', icon: 'i-trend' },
];

export function momentIcon(type: string): IconName {
  return CATALOGUE.find((m) => m.type === type)?.icon ?? 'i-spark';
}

/**
 * The moments not witnessed yet, for the sports the person goes to. With no sport known, all
 * of them: better a full shelf of empty trophies than none.
 */
export function unearnedMoments(
  earned: readonly string[],
  sports: readonly string[],
): { type: string; label: string }[] {
  const have = new Set(earned);
  const inScope = CATALOGUE.filter((m) => sports.length === 0 || sports.includes(m.sport));
  return inScope
    .filter((m) => !have.has(m.type))
    .map((m) => ({ type: m.type, label: momentLabel(m.type) }));
}

export type Trophy = { type: string; label: string; count: number };

type Props = {
  trophies: readonly Trophy[];
  /** Earned trophies open their games. A ghost has none to open, so it is never pressable. */
  onPress?: (type: string) => void;
};

/**
 * Moments as trophies, two to a row. An earned one is a filled tile with its count in the
 * team colour. One not witnessed yet is a dashed ghost, the same shape, waiting.
 */
export function MomentTrophies({ trophies, onPress }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const gap = theme.spacing.md;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', margin: -gap / 2 }}>
      {trophies.map((m) => {
        const earned = m.count > 0;
        const Icon = ICONS[momentIcon(m.type)];
        const tile = earned ? (
          <View
            style={{
              backgroundColor: c.card,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.lg,
              minHeight: 132,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <IconTile icon={momentIcon(m.type)} />
              <Text
                variant="display"
                color="accent"
                style={{ fontSize: 44, lineHeight: 46, fontVariant: ['tabular-nums'] }}
              >
                {m.count}
              </Text>
            </View>
            <Text variant="bodyStrong" weight={750} numberOfLines={2} style={{ marginTop: 'auto' }}>
              {m.label}
            </Text>
          </View>
        ) : (
          <View
            style={{
              borderRadius: theme.radius.lg,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: alpha(c.muted, 0.45),
              padding: theme.spacing.lg - 1.5,
              minHeight: 132,
            }}
          >
            <View style={{ width: 38, height: 38, justifyContent: 'center' }}>
              <Icon size={20} color={alpha(c.muted, 0.8)} />
            </View>
            <Text
              variant="bodyStrong"
              color="muted"
              numberOfLines={2}
              style={{ marginTop: 'auto' }}
            >
              {m.label}
            </Text>
            <Text variant="kicker" color="muted" style={{ fontSize: 9.5, marginTop: 2 }}>
              Not yet
            </Text>
          </View>
        );
        return (
          <View key={m.type} style={{ width: '50%', padding: gap / 2 }}>
            {earned && onPress ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${m.label}, ${m.count}`}
                onPress={() => onPress(m.type)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                {tile}
              </Pressable>
            ) : (
              <View
                accessible
                accessibilityLabel={
                  earned ? `${m.label}, ${m.count}` : `${m.label}, not witnessed yet`
                }
              >
                {tile}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
