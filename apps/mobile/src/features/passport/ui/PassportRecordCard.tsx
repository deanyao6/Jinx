import { formatRecord, formatVsExpected, formatWinRate } from '@jinx/core';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import type { StatsPledge, StatsTeam, WinLossRecord } from '../types';

type Props = {
  overall: WinLossRecord;
  teams: StatsTeam[];
  pledge: StatsPledge;
  label?: string;
  /** Called when the pledge tile is tapped (shows the "vs expected" explanation). */
  onPledgeInfo?: () => void;
};

function Tile({
  record,
  caption,
  gold,
  onPress,
  accessibilityLabel,
}: {
  record: string;
  caption: string;
  gold?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const body = (
    <View
      style={{
        backgroundColor: c.tint,
        borderRadius: theme.radius.md,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm + 2,
        flexBasis: '48%',
        flexGrow: 1,
      }}
    >
      <Text
        variant="h2"
        style={{ color: gold ? c.gold : c.ink, fontVariant: ['tabular-nums'] }}
        numberOfLines={1}
      >
        {record}
      </Text>
      <Text variant="caption" color="muted" numberOfLines={2}>
        {caption}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({ flexBasis: '48%', flexGrow: 1, opacity: pressed ? 0.7 : 1 })}
    >
      {body}
    </Pressable>
  );
}

/**
 * Record card from mockup screen 1: overall record in very large numerals, win rate, one tile per
 * followed franchise, and the pledge tile. Pure: pass in slices of the stats payload.
 */
export function PassportRecordCard({
  overall,
  teams,
  pledge,
  label = 'All-time record at games',
  onPledgeInfo,
}: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const pledged = pledge.record.wins + pledge.record.losses + pledge.record.ties > 0;
  return (
    <Card label={label}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
        <Text
          variant="display"
          accessibilityLabel={`Record ${overall.wins} and ${overall.losses}${
            overall.ties ? ` and ${overall.ties} ties` : ''
          }`}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {overall.wins}
        </Text>
        <Text
          style={{
            fontSize: 44,
            lineHeight: 52,
            fontWeight: '300',
            color: c.muted,
          }}
        >
          –
        </Text>
        <Text variant="display" style={{ fontVariant: ['tabular-nums'] }}>
          {overall.losses}
        </Text>
        {overall.ties > 0 ? (
          <>
            <Text style={{ fontSize: 44, lineHeight: 52, fontWeight: '300', color: c.muted }}>
              –
            </Text>
            <Text variant="display" style={{ fontVariant: ['tabular-nums'] }}>
              {overall.ties}
            </Text>
          </>
        ) : null}
        <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
          <Text variant="caption" color="muted">
            Win rate
          </Text>
          <Text variant="h2" style={{ fontVariant: ['tabular-nums'] }}>
            {formatWinRate(overall)}
          </Text>
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.md,
        }}
      >
        {teams.map((t) => (
          <Tile key={t.franchise_id} record={formatRecord(t.record)} caption={t.name} />
        ))}
        <Tile
          gold
          record={formatRecord(pledge.record)}
          caption={
            pledged
              ? `Pledged, ${formatVsExpected(pledge.vs_expected)} vs expected`
              : 'Pledged, none yet'
          }
          onPress={onPledgeInfo}
          accessibilityLabel="Pledge record. Tap to learn about vs expected"
        />
      </View>
    </Card>
  );
}
