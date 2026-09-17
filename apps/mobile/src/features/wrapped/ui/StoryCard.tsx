import { formatRecord } from '@jinx/core';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { Seal } from '@/components/reference/Seal';
import { defaultShapeKey, useVenueShapes } from '@/features/venues/shapes';
import { TeamTheme } from '@/theme/reference/TeamTheme';
import { useTheme } from '@/theme/ThemeProvider';

import { wrappedCardCopy } from '../copy';
import type { WrappedCard, WrappedTeamRecord } from '../types';
import {
  cardTreatment,
  StoryBackdrop,
  StoryScope,
  StoryShareButton,
  useStoryPalette,
  type StoryPalette,
} from './story';

/** Supporting lines a card has room for under its headline. */
const MAX_LINES = 6;

/** A seal's ring holds about 22 capitals before the text runs past the ends of its arc. */
const RING_MAX = 22;

/** The stadium's name as engraved around a seal, cut at a word when it is too long for the arc. */
function ringLabel(name: string): string {
  const upper = name.trim().toUpperCase();
  if (upper.length <= RING_MAX) return upper;
  let out = '';
  for (const word of upper.split(/\s+/)) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > RING_MAX) break;
    out = next;
  }
  return out || upper.slice(0, RING_MAX);
}

type Props = {
  card: WrappedCard;
  sport: string;
  season: number;
  index: number;
  count: number;
  width: number;
  height: number;
  /** Room for the screen's chrome (status bar, pips, title row), which floats over the card. */
  top: number;
  bottom: number;
  onShare: () => void;
};

/** One full-screen page of the Wrapped story. */
export function StoryCard(props: Props) {
  return (
    <StoryScope card={props.card}>
      <StoryCardBody {...props} />
    </StoryScope>
  );
}

/** The giant line. Short ones are a number and get the whole width; a name steps down to fit. */
function headlineSize(text: string): number {
  if (text.length <= 5) return 148;
  if (text.length <= 9) return 104;
  if (text.length <= 14) return 76;
  return 58;
}

function StoryCardBody({
  card,
  sport,
  season,
  index,
  count,
  width,
  height,
  top,
  bottom,
  onShare,
}: Props) {
  const theme = useTheme();
  const treatment = cardTreatment(card);
  const palette = useStoryPalette(treatment);
  const copy = wrappedCardCopy(card, sport, season);
  const size = headlineSize(copy.headline);
  return (
    <View style={{ width, height }}>
      <StoryBackdrop treatment={treatment} sport={sport} width={width} height={height} />
      <View
        style={{
          flex: 1,
          paddingTop: top,
          paddingHorizontal: theme.spacing.xl,
          paddingBottom: bottom,
        }}
      >
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text variant="kicker" style={{ color: palette.kicker, fontSize: 13, lineHeight: 17 }}>
            {copy.label}
          </Text>
          <Text
            variant="display"
            // No adjustsFontSizeToFit: on iOS it shrinks a condensed face in a tight line box down
            // to a speck. headlineSize() already steps the size down by length instead.
            numberOfLines={size > 100 ? 1 : 3}
            style={{
              color: palette.headline,
              fontSize: size,
              lineHeight: Math.round(size * 1.04),
              letterSpacing: size > 100 ? -1 : 0,
              textTransform: 'uppercase',
              fontVariant: ['tabular-nums'],
              marginTop: theme.spacing.sm,
            }}
          >
            {copy.headline}
          </Text>
          <Text
            variant="body"
            weight={600}
            style={{
              color: palette.fg,
              fontSize: 17,
              lineHeight: 24,
              marginTop: theme.spacing.md,
              maxWidth: 340,
            }}
          >
            {copy.body}
          </Text>
          {card.kind === 'stamps' && card.stamps.new.length ? (
            <NewStampSeals venues={card.stamps.new} sport={sport} ink={palette.fg} />
          ) : null}
          {card.kind === 'record' ? (
            <TeamLines teams={card.teams.slice(0, MAX_LINES)} palette={palette} />
          ) : (
            <View style={{ marginTop: copy.lines.length ? theme.spacing.lg : 0, gap: 6 }}>
              {copy.lines.slice(0, MAX_LINES).map((line) => (
                <Text key={line} variant="sub" numberOfLines={1} style={{ color: palette.soft }}>
                  {line}
                </Text>
              ))}
            </View>
          )}
        </View>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <StoryShareButton palette={palette} onPress={onShare} />
          <Text variant="kicker" style={{ color: palette.soft }}>
            {index + 1} of {count}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * The record card's teams, each line marked in that team's own colour. The same words as the
 * card's plain `lines`, split so the record can sit in the condensed face on the right.
 */
function TeamLines({ teams, palette }: { teams: WrappedTeamRecord[]; palette: StoryPalette }) {
  const theme = useTheme();
  if (!teams.length) return null;
  return (
    <View style={{ marginTop: theme.spacing.lg, gap: 10 }}>
      {teams.map((t) => (
        <TeamTheme key={t.team_id} team={t.team_id}>
          <TeamLine team={t} palette={palette} />
        </TeamTheme>
      ))}
    </View>
  );
}

function TeamLine({ team, palette }: { team: WrappedTeamRecord; palette: StoryPalette }) {
  const { accent } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${team.name} ${formatRecord(team.record)}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
    >
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: accent.themed ? accent.text : palette.soft,
        }}
      />
      <Text variant="sub" weight={650} numberOfLines={1} style={{ flex: 1, color: palette.fg }}>
        {team.name}
      </Text>
      <Text variant="section" style={{ color: palette.fg, fontVariant: ['tabular-nums'] }}>
        {formatRecord(team.record)}
      </Text>
    </View>
  );
}

/** Up to three of the season's new stadiums as the engraved seals they became on the Passport. */
function NewStampSeals({
  venues,
  sport,
  ink,
}: {
  venues: { venue_id: string; name: string }[];
  sport: string;
  ink: string;
}) {
  const theme = useTheme();
  const shapes = useVenueShapes();
  const byVenue = useMemo(
    () => new Map((shapes.data ?? []).map((s) => [s.venue_id, s.shape_key] as const)),
    [shapes.data],
  );
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.xl }}
    >
      {venues.slice(0, 3).map((v) => (
        <Seal
          key={v.venue_id}
          ring={ringLabel(v.name)}
          shapeKey={byVenue.get(v.venue_id) ?? defaultShapeKey([sport])}
          metal="silver"
          size={86}
          inkColor={ink}
        />
      ))}
    </View>
  );
}
