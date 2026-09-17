import React, { useId } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Text } from '@/components/Text';
import { IconShare } from '@/components/reference/icons';
import { SHAPE_VIEWBOX } from '@/components/reference/shapes';
import { StadiumShape } from '@/components/reference/StadiumShape';
import { defaultShapeKey } from '@/features/venues/shapes';
import { alpha } from '@/theme/color';
import { TeamTheme } from '@/theme/reference/TeamTheme';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

import type { WrappedCard, WrappedCardKind } from '../types';

/**
 * How a Wrapped card is painted. `fill` is the team colour edge to edge with the type on top of
 * it. `dark` is the Passport hero's night sky with the team colour glowing out of a corner, and
 * is pinned to the dark scheme whatever the phone is set to, as the hero is.
 */
export type Treatment = 'fill' | 'dark';

/**
 * By kind rather than by position, so a card looks the same wherever it lands in the deck. The
 * payload's order alternates them. The two cards that draw other colours on top of themselves,
 * team dots on `record` and metal seals on `stamps`, are the dark ones, where those read.
 */
const TREATMENT: Record<WrappedCardKind, Treatment> = {
  games: 'fill',
  record: 'dark',
  pledge: 'fill',
  stamps: 'dark',
  player: 'fill',
  moment: 'dark',
  companions: 'fill',
  miles: 'dark',
  superlative: 'fill',
  goals: 'dark',
};

export function cardTreatment(card: WrappedCard): Treatment {
  return TREATMENT[card.kind];
}

/**
 * The team a card is about, when the payload says. Only the record card names teams: it takes the
 * one with the most decided games, the first on a tie. Every other card keeps the person's own.
 */
export function cardTeam(card: WrappedCard): string | null {
  if (card.kind !== 'record') return null;
  let best: string | null = null;
  let most = -1;
  for (const t of card.teams) {
    const decided = t.record.wins + t.record.losses + t.record.ties;
    if (decided > most) {
      most = decided;
      best = t.team_id;
    }
  }
  return best;
}

/** Puts a card's team and scheme in scope. The screen's chrome sits in the same scope as the card under it. */
export function StoryScope({ card, children }: { card: WrappedCard; children: React.ReactNode }) {
  const team = cardTeam(card);
  const themed = team ? <TeamTheme team={team}>{children}</TeamTheme> : <>{children}</>;
  return cardTreatment(card) === 'dark' ? (
    <ThemeProvider scheme="dark">{themed}</ThemeProvider>
  ) : (
    themed
  );
}

export type StoryPalette = {
  /** The flat colour under everything, and what the status bar is judged against. */
  bg: string;
  fg: string;
  /** `fg` for a line of context. */
  soft: string;
  /** `fg` as a fill: an unreached pip, the round button behind the close mark. */
  faint: string;
  headline: string;
  kicker: string;
  buttonBg: string;
  buttonFg: string;
};

// The dark card is a region pinned to one scheme, like the Passport hero it borrows from, so its
// night-sky colours are constants rather than theme tokens.
const NIGHT_TOP = '#1C2331';
const NIGHT = '#0B0F16';
const ON_NIGHT = '#FFFFFF';

/** Call inside a `StoryScope`. */
export function useStoryPalette(treatment: Treatment): StoryPalette {
  const { accent } = useTheme();
  if (treatment === 'fill') {
    return {
      bg: accent.fill,
      fg: accent.onFill,
      soft: alpha(accent.onFill, 0.78),
      faint: alpha(accent.onFill, 0.22),
      headline: accent.onFill,
      kicker: alpha(accent.onFill, 0.82),
      // Inverted, because a washed button vanishes on its own colour.
      buttonBg: accent.onFill,
      buttonFg: accent.fill,
    };
  }
  return {
    bg: NIGHT,
    fg: ON_NIGHT,
    soft: alpha(ON_NIGHT, 0.68),
    faint: alpha(ON_NIGHT, 0.18),
    headline: accent.themed ? accent.text : ON_NIGHT,
    kicker: accent.themed ? accent.text : alpha(ON_NIGHT, 0.68),
    buttonBg: accent.fill,
    buttonFg: accent.onFill,
  };
}

/** The full-bleed background of a card: colour, a glow, and a stadium outline as a watermark. */
export function StoryBackdrop({
  treatment,
  sport,
  width,
  height,
}: {
  treatment: Treatment;
  sport: string;
  width: number;
  height: number;
}) {
  const { accent } = useTheme();
  const palette = useStoryPalette(treatment);
  const uid = useId().replace(/:/g, '');
  const dark = treatment === 'dark';
  const mark = alpha(palette.fg, dark ? 0.07 : 0.1);
  const markSize = width * 1.15;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg, overflow: 'hidden' }]}
    >
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={`sky${uid}`} x1="0" y1="0" x2="0.342" y2="0.94">
            <Stop offset="0" stopColor={NIGHT_TOP} />
            <Stop offset="1" stopColor={NIGHT} />
          </LinearGradient>
          <LinearGradient id={`shade${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.45" stopColor="#000000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.2" />
          </LinearGradient>
          <RadialGradient id={`glow${uid}`} cx="92%" cy="6%" r="70%">
            <Stop
              offset="0"
              stopColor={dark ? accent.fill : accent.second}
              stopOpacity={dark ? 0.6 : 0.3}
            />
            <Stop offset="1" stopColor={dark ? accent.fill : accent.second} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`ember${uid}`} cx="0%" cy="100%" r="60%">
            <Stop offset="0" stopColor={accent.second} stopOpacity="0.26" />
            <Stop offset="1" stopColor={accent.second} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {dark ? <Rect width={width} height={height} fill={`url(#sky${uid})`} /> : null}
        {/* With no team in scope the accent is ink, and an ink glow is only a grey smudge. */}
        {accent.themed ? <Rect width={width} height={height} fill={`url(#glow${uid})`} /> : null}
        {accent.themed && dark ? (
          <Rect width={width} height={height} fill={`url(#ember${uid})`} />
        ) : null}
        {dark ? null : <Rect width={width} height={height} fill={`url(#shade${uid})`} />}
      </Svg>
      <View style={{ position: 'absolute', right: -markSize * 0.36, bottom: -markSize * 0.2 }}>
        <Svg width={markSize} height={markSize} viewBox={SHAPE_VIEWBOX}>
          <G fill="none" stroke={mark} strokeWidth={0.9} color={mark}>
            <StadiumShape shapeKey={defaultShapeKey([sport])} />
          </G>
        </Svg>
      </View>
    </View>
  );
}

/** Story progress at the top of the screen: one segment per card, filled up to the one showing. */
export function StoryPips({
  count,
  page,
  on,
  off,
}: {
  count: number;
  page: number;
  on: string;
  off: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`Card ${page + 1} of ${count}`}
      style={{ flexDirection: 'row', gap: 4 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{ flex: 1, height: 3, borderRadius: 1.5, backgroundColor: i <= page ? on : off }}
        />
      ))}
    </View>
  );
}

/** The one action on a card, in the card's own colours. */
export function StoryShareButton({
  palette,
  onPress,
}: {
  palette: StoryPalette;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 46,
        paddingHorizontal: 18,
        borderRadius: 14,
        backgroundColor: palette.buttonBg,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <IconShare size={16} color={palette.buttonFg} />
      <Text variant="bodyStrong" weight={750} style={{ color: palette.buttonFg }}>
        Share this card
      </Text>
    </Pressable>
  );
}
