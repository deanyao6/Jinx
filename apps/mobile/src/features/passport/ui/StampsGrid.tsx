import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { visitsLabel } from '../format';
import type { StatsStamp } from '../types';
import { Stamp, type StampTone } from './Stamp';

export type GhostVenue = { venue_id: string; name: string };

export type StampCell = {
  key: string;
  name: string;
  caption: string;
  tone: StampTone;
  stamp?: StatsStamp;
  ghost?: GhostVenue;
};

/** Visited stamps first (most visits first), then ghost stamps for unvisited bucket-list venues. */
export function stampCells(stamps: StatsStamp[], ghosts: GhostVenue[] = []): StampCell[] {
  const visited = new Set(stamps.map((s) => s.venue_id));
  const cells: StampCell[] = [...stamps]
    .sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name))
    .map((s) => ({
      key: s.venue_id,
      name: s.name,
      caption: s.closed ? `Closed, ${visitsLabel(s.visits)}` : visitsLabel(s.visits),
      tone: s.closed ? 'closed' : 'visited',
      stamp: s,
    }));
  for (const g of ghosts) {
    if (visited.has(g.venue_id)) continue;
    visited.add(g.venue_id);
    cells.push({
      key: `ghost-${g.venue_id}`,
      name: g.name,
      caption: 'On your list',
      tone: 'ghost',
      ghost: g,
    });
  }
  return cells;
}

type Props = {
  stamps: StatsStamp[];
  ghosts?: GhostVenue[];
  /** Maximum cells to show (the passport preview shows 6). */
  limit?: number;
  columns?: number;
  onPressStamp?: (stamp: StatsStamp) => void;
  onPressGhost?: (ghost: GhostVenue) => void;
};

/** Three-column grid of round stamps, as on mockup screen 1. Pure. */
export function StampsGrid({
  stamps,
  ghosts = [],
  limit,
  columns = 3,
  onPressStamp,
  onPressGhost,
}: Props) {
  const theme = useTheme();
  const cells = stampCells(stamps, ghosts);
  const shown = limit ? cells.slice(0, limit) : cells;
  const gap = theme.spacing.sm;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2 }}>
      {shown.map((cell, i) => (
        <View key={cell.key} style={{ width: `${100 / columns}%`, padding: gap / 2 }}>
          <Stamp
            name={cell.name}
            caption={cell.caption}
            tone={cell.tone}
            index={i}
            onPress={
              cell.stamp && onPressStamp
                ? () => onPressStamp(cell.stamp as StatsStamp)
                : cell.ghost && onPressGhost
                  ? () => onPressGhost(cell.ghost as GhostVenue)
                  : undefined
            }
          />
        </View>
      ))}
    </View>
  );
}
