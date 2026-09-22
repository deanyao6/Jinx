import React from 'react';
import { Pressable, View } from 'react-native';

import { FamousMark } from '@/features/famous/ui/FamousMark';
import { doubleheaderLabel, formatGameDate, formatScore } from '@/lib/format';
import { Text } from './Text';

export type GameRowData = {
  id: string;
  scheduled_start: string;
  status: string;
  awayName: string;
  homeName: string;
  venueName?: string | null;
  home_score: number | null;
  away_score: number | null;
  is_tie?: boolean | null;
  doubleheader_number?: number | null;
  /** Search dates are venue-local; preserve that calendar day in the row. */
  local_date?: string;
};

type Props = {
  game: GameRowData;
  onPress?: () => void;
  right?: React.ReactNode;
  badge?: string | null;
  /** The badge is a label in the team colour unless it reports a state. */
  badgeTone?: 'accent' | 'green' | 'red' | 'muted';
  first?: boolean;
  /** A famous game: a small gold mark beside the title. */
  famous?: boolean;
};

/** "date · away at home · venue · score" list row used by search, history, and upcoming. */
export function GameRow({
  game,
  onPress,
  right,
  badge,
  badgeTone = 'accent',
  famous = false,
}: Props) {
  const score = formatScore({
    homeScore: game.home_score,
    awayScore: game.away_score,
    status: game.status,
    isTie: game.is_tie,
  });
  const dh = doubleheaderLabel(game.doubleheader_number);
  const meta = [
    formatGameDate(game.local_date ? `${game.local_date}T12:00:00` : game.scheduled_start),
    game.venueName,
    dh,
  ]
    .filter(Boolean)
    .join(' · ');
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 11,
      }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
            {game.awayName} at {game.homeName}
          </Text>
          {famous ? <FamousMark /> : null}
        </View>
        <Text variant="caption" color="muted" numberOfLines={1}>
          {meta}
        </Text>
        {badge ? (
          <Text variant="label" color={badgeTone} style={{ marginTop: 2 }}>
            {badge}
          </Text>
        ) : null}
      </View>
      {right ?? (
        <Text
          variant="stat"
          color={game.status === 'final' ? 'ink' : 'muted'}
          style={{ fontSize: 20, lineHeight: 22, fontVariant: ['tabular-nums'] }}
        >
          {score}
        </Text>
      )}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {body}
    </Pressable>
  );
}
