import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
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
import { Row } from '@/components/Row';
import { Text } from '@/components/Text';
import { Sheet } from '@/features/passport/ui/Sheet';
import { openShare } from '@/features/share/navigate';
import { wrappedCardCopy, wrappedTitle } from '@/features/wrapped/copy';
import {
  isPreviewSeason,
  seasonOptions,
  useRegenerateWrapped,
  useWrapped,
  useWrappedSeasons,
} from '@/features/wrapped/queries';
import type { WrappedCard } from '@/features/wrapped/types';
import { sportLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

/** Full-screen, horizontally paged Wrapped cards for one sport and season (SPEC.md 8.8). */
export default function WrappedScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ sport: string; season: string }>();
  const sport = params.sport;
  const season = Number(params.season);
  const valid = !!sport && Number.isInteger(season) && season > 1990;

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

  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      <View
        style={{
          paddingTop: insets.top + theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: c.tint,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="close" size={20} color={c.ink} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick a season"
          onPress={() => setPicking(true)}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text variant="h2" numberOfLines={1}>
            {title}
          </Text>
          <Ionicons name="chevron-down" size={18} color={c.muted} />
        </Pressable>
        {preview ? (
          <View
            style={{
              borderRadius: theme.radius.pill,
              borderWidth: 1,
              borderColor: c.gold,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text variant="label" color="gold">
              Preview
            </Text>
          </View>
        ) : null}
      </View>

      {!valid ? (
        <View style={{ padding: theme.spacing.lg }}>
          <EmptyState
            title="Pick a season"
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
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={cards}
            keyExtractor={(card, i) => `${card.kind}-${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            getItemLayout={(_d, index) => ({ length: width, offset: width * index, index })}
            renderItem={({ item, index }) => (
              <WrappedCardView
                card={item}
                sport={sport}
                season={season}
                index={index}
                count={cards.length}
                width={width}
                onShare={() => openShare(router, { kind: 'wrapped', sport, season, card: item })}
              />
            )}
          />
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
              paddingTop: theme.spacing.sm,
              paddingBottom: insets.bottom + theme.spacing.md,
            }}
            accessibilityLabel={`Card ${page + 1} of ${cards.length}`}
          >
            {cards.map((card, i) => (
              <View
                key={`${card.kind}-${i}`}
                style={{
                  width: i === page ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === page ? c.ink : c.line,
                }}
              />
            ))}
          </View>
        </>
      )}

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

function WrappedCardView({
  card,
  sport,
  season,
  index,
  count,
  width,
  onShare,
}: {
  card: WrappedCard;
  sport: string;
  season: number;
  index: number;
  count: number;
  width: number;
  onShare: () => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const copy = wrappedCardCopy(card, sport, season);
  const accent = c[copy.accent];
  const big = copy.headline.length > 12;
  return (
    <View style={{ width, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm }}>
      <View
        style={{
          flex: 1,
          backgroundColor: c.card,
          borderColor: c.line,
          borderWidth: 1,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.xl,
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            backgroundColor: accent,
          }}
        />
        <Text variant="caption" color="muted">
          {index + 1} of {count}
        </Text>
        <View>
          <Text
            variant="label"
            style={{
              color: accent,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              marginBottom: 8,
            }}
          >
            {copy.label}
          </Text>
          <Text
            variant="display"
            numberOfLines={3}
            adjustsFontSizeToFit
            style={{
              color: accent,
              fontSize: big ? 40 : 72,
              lineHeight: big ? 44 : 76,
              fontVariant: ['tabular-nums'],
            }}
          >
            {copy.headline}
          </Text>
          <Text variant="body" style={{ marginTop: theme.spacing.md }}>
            {copy.body}
          </Text>
          {copy.lines.slice(0, 6).map((line) => (
            <Text key={line} variant="sub" color="muted" style={{ marginTop: 4 }} numberOfLines={1}>
              {line}
            </Text>
          ))}
        </View>
        <Button
          title="Share this card"
          variant="secondary"
          onPress={onShare}
          style={{ alignSelf: 'flex-start' }}
        />
      </View>
    </View>
  );
}
