import React from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/Card';
import { IconTile } from '@/components/IconTile';
import { IconChevR, type IconName } from '@/components/reference/icons';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import type { SuperlativeRow } from '../format';

/** The reference's icon for each superlative, by the stable `key` of `superlativeRows`. */
const ICON_BY_KEY: Record<string, IconName> = {
  most_seen_player: 'i-user',
  walk_offs: 'i-bolt',
  coldest: 'i-thermo',
  hottest: 'i-thermo',
  longest: 'i-clock',
  biggest_comeback: 'i-trend',
  highest_scoring: 'i-trend',
  lowest_scoring: 'i-trend',
  longest_win: 'i-trend',
  longest_loss: 'i-trend',
  most_visited_venue: 'i-speaker',
  farthest_venue: 'i-route',
  most_miles_team: 'i-route',
  first_game: 'i-book',
};

export function superlativeIcon(key: string): IconName {
  return ICON_BY_KEY[key] ?? (key.startsWith('most_seen_') ? 'i-users' : 'i-spark');
}

type GroupKey = 'games' | 'players' | 'places' | 'streaks';

const GROUP_TITLES: Record<GroupKey, string> = {
  games: 'Games',
  players: 'Players',
  places: 'Stadiums and travel',
  streaks: 'Streaks',
};

const GROUP_ORDER: GroupKey[] = ['games', 'players', 'places', 'streaks'];

function groupOf(row: SuperlativeRow): GroupKey {
  if (row.key.startsWith('most_seen_')) return 'players';
  if (row.key === 'longest_win' || row.key === 'longest_loss') return 'streaks';
  if (
    row.key === 'most_visited_venue' ||
    row.key === 'farthest_venue' ||
    row.key === 'most_miles_team'
  ) {
    return 'places';
  }
  return 'games';
}

/** Rows in their sections, keeping the order `superlativeRows` ranked them in. */
export function groupSuperlatives(
  rows: SuperlativeRow[],
): { key: GroupKey; title: string; rows: SuperlativeRow[] }[] {
  return GROUP_ORDER.map((key) => ({
    key,
    title: GROUP_TITLES[key],
    rows: rows.filter((row) => groupOf(row) === key),
  })).filter((group) => group.rows.length > 0);
}

export type SuperlativeContext = {
  /** A few words on a filled chip, as the Passport's list has: "Apr 3, 2024". */
  chip?: string | null;
  /** A quiet line under the value: the matchup of the game the row points at. */
  detail?: string | null;
};

type Props = {
  rows: SuperlativeRow[];
  contextFor?: (row: SuperlativeRow) => SuperlativeContext | null;
  onPressRow?: (row: SuperlativeRow) => void;
};

/**
 * The Passport's superlatives list at full length: an icon tile in the team colour, a small
 * label, the value in condensed heavy type, and a context chip. One card per section, rows set
 * apart by their padding.
 */
export function SuperlativeCards({ rows, contextFor, onPressRow }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <>
      {groupSuperlatives(rows).map((group) => (
        <View key={group.key} style={{ marginBottom: theme.spacing.sm }}>
          <SectionHeader title={group.title} />
          <Card style={{ paddingVertical: theme.spacing.xs + 2 }}>
            {group.rows.map((row) => {
              const context = contextFor?.(row) ?? null;
              const pressable = !!onPressRow && !!(row.gameId || row.venueId || row.playerId);
              const body = (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 10,
                  }}
                >
                  <IconTile icon={superlativeIcon(row.key)} size={42} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="label" color="muted" numberOfLines={2}>
                      {row.title}
                    </Text>
                    <Text
                      variant="stat"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={{ fontSize: 26, lineHeight: 28, marginTop: 1 }}
                    >
                      {row.value}
                    </Text>
                    {context?.detail ? (
                      <Text variant="caption" color="muted" numberOfLines={1}>
                        {context.detail}
                      </Text>
                    ) : null}
                  </View>
                  {context?.chip ? (
                    <View
                      style={{
                        backgroundColor: c.tint,
                        borderRadius: 6,
                        paddingHorizontal: 7,
                        paddingVertical: 3,
                      }}
                    >
                      <Text variant="label">{context.chip}</Text>
                    </View>
                  ) : null}
                  {pressable ? <IconChevR size={16} color={c.muted} /> : null}
                </View>
              );
              if (!pressable) return <View key={row.key}>{body}</View>;
              return (
                <Pressable
                  key={row.key}
                  accessibilityRole="button"
                  onPress={() => onPressRow?.(row)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  {body}
                </Pressable>
              );
            })}
          </Card>
        </View>
      ))}
    </>
  );
}
