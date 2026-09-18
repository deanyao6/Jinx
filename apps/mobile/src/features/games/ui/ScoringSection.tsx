import { scoringLines, scoringWhen, type ScoringLine, type ScoringRow } from '@jinx/core';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

import { SideTheme } from './SideTheme';

/** How many plays show before "Show all". Six is a whole baseball game more often than not. */
const FOLDED = 6;

type Props = {
  sport: string;
  rows: readonly ScoringRow[];
  /** Team ids by side, so each line takes the colour of the side that scored. */
  homeTeamId: string | null;
  awayTeamId: string | null;
};

/**
 * Every scoring play, oldest first: when, what and who, and the score after it (SPEC.md
 * 5.1). The words come from `scoringLines` in core, which folds an NFL extra point into the
 * touchdown before it; the table underneath keeps both rows. Renders nothing for a game with
 * no timeline, so a page never shows an empty section.
 */
export function ScoringSection({ sport, rows, homeTeamId, awayTeamId }: Props) {
  const theme = useTheme();
  const [showAll, setShowAll] = useState(false);
  const lines = useMemo(() => scoringLines(sport, rows), [sport, rows]);
  if (lines.length === 0) return null;
  const shown = showAll || lines.length <= FOLDED ? lines : lines.slice(0, FOLDED);
  return (
    <View testID="scoring-section">
      <SectionHeader title="Scoring" />
      <Card style={{ paddingVertical: theme.spacing.sm }}>
        {shown.map((line) => (
          <SideTheme key={line.seq} team={line.scoringSide === 'home' ? homeTeamId : awayTeamId}>
            <ScoringRowView sport={sport} line={line} />
          </SideTheme>
        ))}
        {lines.length > FOLDED ? (
          <Button
            title={showAll ? 'Show fewer' : `Show all ${lines.length}`}
            variant="ghost"
            small
            onPress={() => setShowAll((v) => !v)}
            style={{ alignSelf: 'flex-start', marginTop: 2 }}
          />
        ) : null}
      </Card>
    </View>
  );
}

/** One play: the kicker and the note on the left, the running score in condensed type on the right. */
function ScoringRowView({ sport, line }: { sport: string; line: ScoringLine }) {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel={`${scoringWhen(sport, line.period, line.half, line.clock)}, ${line.note}${line.suffix ? `, ${line.suffix}` : ''}, ${line.awayScore} to ${line.homeScore}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent.fill }} />
      <View style={{ flex: 1 }}>
        <Text variant="kicker" color="accent">
          {scoringWhen(sport, line.period, line.half, line.clock)}
        </Text>
        <Text variant="bodyStrong" style={{ marginTop: 1 }}>
          {line.note}
        </Text>
        {line.suffix ? (
          <Text variant="caption" color="muted">
            {line.suffix}
          </Text>
        ) : null}
      </View>
      <Text
        variant="stat"
        color="accent"
        // The stat cut at a size a row can hold. Condensed heavy, as every score is.
        style={{ fontSize: 20, lineHeight: 22 }}
      >
        {line.awayScore} – {line.homeScore}
      </Text>
    </View>
  );
}
