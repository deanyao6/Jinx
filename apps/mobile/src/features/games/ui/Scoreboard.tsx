import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { alpha } from '@/theme/color';
import { useTheme } from '@/theme/ThemeProvider';
import { SideTheme } from './SideTheme';
import { TeamBadge } from './TeamBadge';

export type ScoreboardSide = {
  teamId: string | null;
  /** For the badge. A caller that does not have one gets the block without a badge. */
  abbreviation?: string | null;
  /** The short name: "Phillies". */
  name: string;
  /** The score as shown, or an en dash before there is one. Left out, the block is a matchup. */
  score?: string;
};

type Props = {
  away: ScoreboardSide;
  home: ScoreboardSide;
  /** Which side won. Null before the final and for a tie: both sides then stay at full strength. */
  winner: 'away' | 'home' | null;
  /** Small capitals over the status line: "MLB · Postseason". */
  kicker?: string | null;
  /** "Final · Sat, Nov 28, 2025, 3:00 PM". */
  status: string;
  venue?: string | null;
  /** Anything that belongs under the venue line, such as the link to a makeup game. */
  children?: React.ReactNode;
};

/**
 * The top of a page about one game: each side is a block in its own team's fill with its badge,
 * its name and its score, the loser dimmed, and the status, date and venue underneath.
 */
export function Scoreboard({ away, home, winner, kicker, status, venue, children }: Props) {
  const theme = useTheme();
  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        backgroundColor: theme.colors.card,
        marginBottom: theme.spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 2 }}>
        <SideTheme team={away.teamId}>
          <SideBlock side={away} where="Away" align="left" dimmed={winner === 'home'} />
        </SideTheme>
        <SideTheme team={home.teamId}>
          <SideBlock side={home} where="Home" align="right" dimmed={winner === 'away'} />
        </SideTheme>
      </View>
      <View style={{ padding: theme.spacing.lg, gap: 2 }}>
        {kicker ? (
          <Text variant="kicker" color="accent" style={{ marginBottom: 2 }}>
            {kicker}
          </Text>
        ) : null}
        <Text variant="bodyStrong">{status}</Text>
        {venue ? (
          <Text variant="sub" color="muted">
            {venue}
          </Text>
        ) : null}
        {children}
      </View>
    </View>
  );
}

function SideBlock({
  side,
  where,
  align,
  dimmed,
}: {
  side: ScoreboardSide;
  where: 'Away' | 'Home';
  align: 'left' | 'right';
  dimmed: boolean;
}) {
  const { accent } = useTheme();
  const right = align === 'right';
  return (
    <View
      accessible
      accessibilityLabel={[side.name, where.toLowerCase(), side.score].filter(Boolean).join(', ')}
      style={{ flex: 1, backgroundColor: accent.solid, justifyContent: 'space-between' }}
    >
      <View
        style={{
          paddingHorizontal: 14,
          paddingTop: 14,
          paddingBottom: 10,
          alignItems: right ? 'flex-end' : 'flex-start',
          opacity: dimmed ? 0.55 : 1,
        }}
      >
        <View
          style={{
            flexDirection: right ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          {side.abbreviation ? <TeamBadge label={side.abbreviation} size={40} /> : null}
          <Text variant="kicker" style={{ color: alpha(accent.onSolid, 0.72) }}>
            {where}
          </Text>
        </View>
        <Text
          variant="h2"
          numberOfLines={2}
          align={right ? 'right' : 'left'}
          style={{ color: accent.onSolid }}
        >
          {side.name}
        </Text>
        {side.score != null ? (
          <Text
            variant="display"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ color: accent.onSolid, fontVariant: ['tabular-nums'], marginTop: 6 }}
          >
            {side.score}
          </Text>
        ) : null}
      </View>
      <View style={{ height: 4, backgroundColor: accent.second }} />
    </View>
  );
}
