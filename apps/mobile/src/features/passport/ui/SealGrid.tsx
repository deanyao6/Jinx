import React from 'react';
import { Pressable, View } from 'react-native';

import { ICONS } from '@/components/reference/icons';
import { Text } from '@/components/Text';
import { VenueSeal } from '@/features/passport/seals';
import { defaultShapeKey } from '@/features/venues/shapes';
import { alpha } from '@/theme/color';
import { useTheme } from '@/theme/ThemeProvider';
import { visitsLabel } from '../format';
import type { StampCell } from './StampsGrid';

const SEAL = 88;

/** The ring holds about 22 capitals before the text runs past the ends of its arc. */
const RING_MAX = 22;

/** The name engraved around the seal, cut at a word when it is too long for the arc. */
export function ringLabel(name: string): string {
  const upper = name.trim().toUpperCase();
  if (upper.length <= RING_MAX) return upper;
  const words = upper.split(/\s+/);
  let out = '';
  for (const word of words) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > RING_MAX) break;
    out = next;
  }
  return out || upper.slice(0, RING_MAX);
}

function firstVisitYear(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

type Props = {
  /** Cells from `stampCells`, which already orders them and writes their captions. */
  cells: StampCell[];
  /** Stadium shape per venue id, from `venue_shapes`. Missing venues fall back by sport. */
  shapes: ReadonlyMap<string, string>;
  onPressCell?: (cell: StampCell) => void;
};

/**
 * The Passport's engraved seals in a three-column grid, with what the rail on the tab has no
 * room for: visit count and the year of the first visit. Each seal is in the colours of the
 * team that plays there, worn by the visits and gold after a rare game (`VenueSeal`). A closed
 * venue has no team, so it is slate, faded, with its caption in grey. A ghost is a dashed ring: on a list, not yet earned.
 */
export function SealGrid({ cells, shapes, onPressCell }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const Target = ICONS['i-target'];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: theme.spacing.lg }}>
      {cells.map((cell) => {
        const stamp = cell.stamp;
        const closed = cell.tone === 'closed';
        const year = firstVisitYear(stamp?.first_visit);
        const body = (
          <View style={{ alignItems: 'center', paddingHorizontal: 4 }}>
            <View style={{ marginBottom: 8, opacity: closed ? 0.45 : 1 }}>
              {stamp ? (
                <VenueSeal
                  venueId={stamp.venue_id}
                  ring={ringLabel(stamp.name)}
                  shapeKey={shapes.get(stamp.venue_id) ?? defaultShapeKey(stamp.sports)}
                  visits={stamp.visits}
                  size={SEAL}
                  inkColor={c.ink}
                />
              ) : (
                <View
                  style={{
                    width: SEAL,
                    height: SEAL,
                    borderRadius: SEAL / 2,
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: alpha(c.muted, 0.55),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Target size={26} color={alpha(c.muted, 0.7)} />
                </View>
              )}
            </View>
            <Text
              variant="caption"
              weight={800}
              align="center"
              numberOfLines={2}
              color={stamp && !closed ? 'ink' : 'muted'}
            >
              {cell.name}
            </Text>
            {stamp?.city ? (
              <Text
                variant="kicker"
                color="muted"
                align="center"
                numberOfLines={1}
                style={{ fontSize: 9.5, marginTop: 2 }}
              >
                {stamp.city}
              </Text>
            ) : null}
            {stamp ? (
              <>
                <Text
                  variant="label"
                  weight={750}
                  align="center"
                  color={closed ? 'muted' : 'accent'}
                  style={{ marginTop: 4 }}
                >
                  {closed ? `Closed · ${visitsLabel(stamp.visits)}` : visitsLabel(stamp.visits)}
                </Text>
                {year ? (
                  <Text variant="label" color="muted" align="center">
                    Since {year}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text
                variant="kicker"
                color="muted"
                align="center"
                style={{ fontSize: 9.5, marginTop: 2 }}
              >
                {cell.caption}
              </Text>
            )}
          </View>
        );
        return (
          <View key={cell.key} style={{ width: `${100 / 3}%` }}>
            {onPressCell ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${cell.name}, ${cell.caption}`}
                onPress={() => onPressCell(cell)}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                {body}
              </Pressable>
            ) : (
              body
            )}
          </View>
        );
      })}
    </View>
  );
}
