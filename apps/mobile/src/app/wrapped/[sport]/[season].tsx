import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { IconChevR, IconPlus } from '@/components/reference/icons';
import { Row } from '@/components/Row';
import { Text } from '@/components/Text';
import { Sheet } from '@/features/passport/ui/Sheet';
import { openShare } from '@/features/share/navigate';
import { wrappedTitle } from '@/features/wrapped/copy';
import {
  isPreviewSeason,
  seasonOptions,
  useRegenerateWrapped,
  useWrapped,
  useWrappedSeasons,
} from '@/features/wrapped/queries';
import type { WrappedCard } from '@/features/wrapped/types';
import { cardTreatment, StoryPips, StoryScope, useStoryPalette } from '@/features/wrapped/ui/story';
import { StoryCard } from '@/features/wrapped/ui/StoryCard';
import { sportLabel } from '@/lib/format';
import { alpha, luminance } from '@/theme/color';
import { useTheme } from '@/theme/ThemeProvider';

/** The chrome under the status bar: 8, the pips, 10, the 36 title row, 8. Cards pad past it. */
const CHROME_HEIGHT = 8 + 3 + 10 + 36 + 8;

/**
 * Wrapped for one sport and season (SPEC.md 8.8): a full-screen story, paged sideways. Each card
 * paints the whole screen and the chrome (pips, close, the season picker) floats over it in that
 * card's colours.
 */
export default function WrappedScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const window = useWindowDimensions();
  const width = window.width;
  // A full-screen modal is the window, but measure rather than assume: a card is sized to this.
  const [height, setHeight] = useState(window.height);
  const params = useLocalSearchParams<{ sport: string; season: string }>();
  const sport = params.sport;
  const season = Number(params.season);
  const valid = !!sport && sport !== 'mls' && Number.isInteger(season) && season > 1990;

  const wrapped = useWrapped(valid ? sport : undefined, valid ? season : undefined);
  const seasons = useWrappedSeasons();
  const regenerate = useRegenerateWrapped();
  const [page, setPage] = useState(0);
  const [picking, setPicking] = useState(false);
  const listRef = useRef<FlatList<WrappedCard>>(null);

  const options = useMemo(() => seasonOptions(seasons.data ?? []), [seasons.data]);
  const preview = valid && isPreviewSeason(sport, season);
  const cards = wrapped.data?.cards ?? [];

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  const goTo = (s: string, y: number) => {
    setPicking(false);
    setPage(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    router.setParams({ sport: s, season: String(y) });
  };

  const title = valid ? wrappedTitle(sport, season) : 'Wrapped';
  const onClose = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const onPick = () => setPicking(true);

  const story = valid && !!wrapped.data;
  // The card the chrome is floating over. None while the deck is empty or still settling.
  const showing = story ? cards[Math.min(page, cards.length - 1)] : undefined;

  return (
    <View
      style={{ flex: 1, backgroundColor: c.screen }}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      {story ? (
        <FlatList
          ref={listRef}
          style={StyleSheet.absoluteFill}
          data={cards}
          keyExtractor={(card, i) => `${card.kind}-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_d, index) => ({ length: width, offset: width * index, index })}
          renderItem={({ item, index }) => (
            <StoryCard
              card={item}
              sport={sport}
              season={season}
              index={index}
              count={cards.length}
              width={width}
              height={height}
              top={insets.top + CHROME_HEIGHT + theme.spacing.lg}
              bottom={insets.bottom + theme.spacing.xl}
              onShare={() => openShare(router, { kind: 'wrapped', sport, season, card: item })}
            />
          )}
        />
      ) : null}

      {showing ? (
        <StoryScope card={showing}>
          <CardChrome
            card={showing}
            title={title}
            preview={preview}
            page={page}
            count={cards.length}
            onClose={onClose}
            onPick={onPick}
          />
        </StoryScope>
      ) : (
        <Chrome
          title={title}
          preview={preview}
          colors={{
            fg: c.ink,
            soft: c.muted,
            faint: alpha(c.ink, theme.scheme === 'dark' ? 0.12 : 0.07),
            badgeBg: alpha(c.gold, 0.16),
            badgeFg: c.gold,
          }}
          onClose={onClose}
          onPick={onPick}
        />
      )}

      {!valid ? (
        <View style={{ padding: theme.spacing.lg }}>
          <EmptyState
            icon="i-spark"
            title={sport === 'mls' ? 'MLS Wrapped is not available yet' : 'Pick a season'}
            actionTitle="Choose"
            onAction={() => setPicking(true)}
          />
        </View>
      ) : wrapped.isPending ? (
        <Loading label={preview ? 'Building your preview' : 'Opening your Wrapped'} />
      ) : wrapped.isError ? (
        <View style={{ padding: theme.spacing.lg }}>
          <ErrorNotice error={wrapped.error} onRetry={wrapped.refetch} />
        </View>
      ) : !wrapped.data ? (
        <View style={{ padding: theme.spacing.lg }}>
          <EmptyState
            icon="i-spark"
            title={`No ${sportLabel(sport)} games in ${season}`}
            body="Wrapped needs at least one game that went final. Log one and come back."
            actionTitle="Log a game"
            onAction={() => router.replace('/(tabs)/games?segment=log' as Href)}
          />
          <Button
            title="Pick another season"
            variant="ghost"
            onPress={() => setPicking(true)}
            style={{ marginTop: theme.spacing.sm }}
          />
        </View>
      ) : null}

      <Sheet visible={picking} title="Seasons" onClose={() => setPicking(false)}>
        {regenerate.isError ? <ErrorNotice error={regenerate.error} /> : null}
        {seasons.isError ? <ErrorNotice error={seasons.error} onRetry={seasons.refetch} /> : null}
        {options.map((o, i) => {
          const isPreview = isPreviewSeason(o.sport_id, o.season);
          const current = o.sport_id === sport && o.season === season;
          return (
            <Row
              key={`${o.sport_id}-${o.season}`}
              first={i === 0}
              icon={isPreview ? 'i-clock' : 'i-spark'}
              title={wrappedTitle(o.sport_id, o.season)}
              subtitle={
                isPreview
                  ? o.generated_at
                    ? `Preview, built ${new Date(o.generated_at).toLocaleDateString()}`
                    : 'Preview of the season so far'
                  : o.generated_at
                    ? `Published ${new Date(o.generated_at).toLocaleDateString()}`
                    : null
              }
              chevron={!current}
              right={
                current ? (
                  <Text variant="caption" color="muted">
                    Open
                  </Text>
                ) : null
              }
              onPress={current ? undefined : () => goTo(o.sport_id, o.season)}
            />
          );
        })}
        {valid && preview && wrapped.data ? (
          <Button
            title="Rebuild this preview"
            variant="secondary"
            loading={regenerate.isPending}
            onPress={() =>
              regenerate.mutate({ sport, season }, { onSuccess: () => setPicking(false) })
            }
            style={{ marginTop: theme.spacing.lg }}
          />
        ) : null}
        <Text variant="caption" color="muted" style={{ marginTop: theme.spacing.md }}>
          A season is published after its final game. Until then this is a preview of the games you
          have logged so far.
        </Text>
      </Sheet>
    </View>
  );
}

type ChromeColors = {
  fg: string;
  soft: string;
  /** `fg` as a fill: the round close button, an unreached pip. */
  faint: string;
  badgeBg: string;
  badgeFg: string;
};

/** The chrome over a card, in that card's colours. Rendered inside the card's `StoryScope`. */
function CardChrome({
  card,
  title,
  preview,
  page,
  count,
  onClose,
  onPick,
}: {
  card: WrappedCard;
  title: string;
  preview: boolean;
  page: number;
  count: number;
  onClose: () => void;
  onPick: () => void;
}) {
  const palette = useStoryPalette(cardTreatment(card));
  return (
    <>
      {/* The card runs under the status bar, so the clock has to read on the card's colour. */}
      <StatusBar style={luminance(palette.bg) < 0.4 ? 'light' : 'dark'} />
      <Chrome
        title={title}
        preview={preview}
        colors={{
          fg: palette.fg,
          soft: palette.soft,
          faint: palette.faint,
          badgeBg: palette.faint,
          badgeFg: palette.fg,
        }}
        pips={{ page, count }}
        onClose={onClose}
        onPick={onPick}
      />
    </>
  );
}

/** Progress pips, then close, the season title that opens the picker, and the preview badge. */
function Chrome({
  title,
  preview,
  colors,
  pips,
  onClose,
  onPick,
}: {
  title: string;
  preview: boolean;
  colors: ChromeColors;
  pips?: { page: number; count: number };
  onClose: () => void;
  onPick: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        paddingTop: insets.top + 8,
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: 8,
        gap: 10,
      }}
    >
      {pips ? (
        <StoryPips page={pips.page} count={pips.count} on={colors.fg} off={colors.faint} />
      ) : (
        <View style={{ height: 3 }} />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.faint,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          {/* The reference icon set has no cross, and its plus turned an eighth is one. */}
          <View style={{ transform: [{ rotate: '45deg' }] }}>
            <IconPlus size={20} color={colors.fg} />
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick a season"
          onPress={onPick}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text variant="h2" numberOfLines={1} style={{ color: colors.fg, flexShrink: 1 }}>
            {title}
          </Text>
          <View style={{ transform: [{ rotate: '90deg' }] }}>
            <IconChevR size={16} color={colors.soft} />
          </View>
        </Pressable>
        {preview ? (
          <View
            style={{
              borderRadius: theme.radius.pill,
              backgroundColor: colors.badgeBg,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text variant="kicker" style={{ color: colors.badgeFg }}>
              Preview
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
