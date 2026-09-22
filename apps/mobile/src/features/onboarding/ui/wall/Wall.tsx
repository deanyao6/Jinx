import React from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { COLUMNS, COLUMN_MOTION } from './columns';
import type { WallCardSpec } from './fixtures';
import { dateLabel } from './dateLabel';
import { GameCard } from './cards/GameCard';
import { MomentCard } from './cards/MomentCard';
import { PhotoCard } from './cards/PhotoCard';
import { SealCard } from './cards/SealCard';
import {
  BuddyCard,
  GhostStampCard,
  LiveCard,
  PledgeCard,
  StreakCard,
  WrappedCard,
} from './cards/SmallCards';
import { StubCard } from './cards/StubCard';
import { WALL, WALL_FRAME } from './styles';
import { teamFill } from './teamFills';
import type { WallGame } from './types';

/**
 * The wall: three columns of cards drifting behind the sign-in copy, tilted seven degrees,
 * oversize so no edge shows (`.wallwrap`, `.wall`, `.col` in `design/welcome-reference.html`).
 *
 * Each column draws its list twice, one stack under the other, and slides by exactly one stack
 * (plus the gap) on a linear loop, so the seam never shows. The reference animates
 * `translateY(-50%)`, but its columns are stretched to the wall's height, so that is half
 * the column box and not the stack, and its loop visibly jumps; the app measures the stack
 * and moves by that (design/PORTING_NOTES.md). Column 1 climbs over 34s, column 2 descends
 * over 44s, column 3 climbs over 26s. Every loop starts at phase zero on mount, so two launches
 * look the same at the same elapsed time.
 *
 * `still` (Reduce Motion, or the frozen screenshot state) holds every column at phase zero.
 *
 * The whole thing is decoration: hidden from VoiceOver as one element, and it never takes a
 * touch.
 */
export const Wall = React.memo(function Wall({
  games,
  today,
  still,
}: {
  games: readonly WallGame[];
  /** `YYYY-MM-DD` on the device, for the date labels. */
  today: string;
  still: boolean;
}) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
    >
      <View
        style={{
          position: 'absolute',
          left: WALL_FRAME.left,
          top: WALL_FRAME.top,
          width: WALL_FRAME.width,
          height: WALL_FRAME.height,
          flexDirection: 'row',
          gap: WALL.gap,
          transform: [{ rotate: WALL_FRAME.rotate }],
        }}
      >
        {COLUMNS.map((specs, i) => (
          <Column
            key={i}
            index={i}
            specs={specs}
            games={games}
            today={today}
            still={still}
            direction={COLUMN_MOTION[i]?.direction ?? 'up'}
            durationMs={COLUMN_MOTION[i]?.durationMs ?? 30_000}
          />
        ))}
      </View>
    </View>
  );
});

function Column({
  index,
  specs,
  games,
  today,
  still,
  direction,
  durationMs,
}: {
  index: number;
  specs: readonly WallCardSpec[];
  games: readonly WallGame[];
  today: string;
  still: boolean;
  direction: 'up' | 'down';
  durationMs: number;
}) {
  // 0 at phase zero, 1 after one full stack. Linear, forever.
  const progress = useSharedValue(0);
  const period = useSharedValue(0);

  React.useEffect(() => {
    progress.value = 0;
    if (still) return;
    progress.value = withRepeat(withTiming(1, { duration: durationMs, easing: Easing.linear }), -1, false);
  }, [durationMs, progress, still]);

  const onStackLayout = (e: LayoutChangeEvent) => {
    period.value = e.nativeEvent.layout.height + WALL.gap;
  };

  const style = useAnimatedStyle(() => {
    // Up: 0 to -period. Down: -period to 0. Both ends show the same frame.
    const y = direction === 'up' ? -progress.value * period.value : -(1 - progress.value) * period.value;
    return { transform: [{ translateY: y }] };
  });

  const stack = (copy: number) => (
    <View style={{ gap: WALL.gap }} onLayout={copy === 0 ? onStackLayout : undefined}>
      {specs.map((spec, j) => (
        <Card key={j} id={`c${index}-${copy}-${j}`} spec={spec} games={games} today={today} still={still} />
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={[{ gap: WALL.gap }, style]}>
        {stack(0)}
        {stack(1)}
      </Animated.View>
    </View>
  );
}

const Card = React.memo(function Card({
  id,
  spec,
  games,
  today,
  still,
}: {
  id: string;
  spec: WallCardSpec;
  games: readonly WallGame[];
  today: string;
  still: boolean;
}) {
  switch (spec.kind) {
    case 'game': {
      const game = games[spec.index];
      if (!game) return null;
      const color = game.fill ?? teamFill(game.teamKey) ?? WALL.meta;
      const label = game.playedOn ? dateLabel(game.playedOn, game.night, today) : game.dateLabel;
      return (
        <GameCard
          id={id}
          title={game.title}
          venue={game.venue}
          dateLabel={label}
          result={game.result}
          color={color}
        />
      );
    }
    case 'seal':
      return <SealCard id={id} ring={spec.ring} shape={spec.shape} metal={spec.metal} still={still} />;
    case 'stub':
      return <StubCard team={spec.team} sec={spec.sec} row={spec.row} seat={spec.seat} />;
    case 'moment':
      return <MomentCard id={id} tag={spec.tag} line={spec.line} sub={spec.sub} still={still} />;
    case 'photo':
      return <PhotoCard scene={spec.scene} sky={spec.sky} caption={spec.caption} />;
    case 'buddy':
      return (
        <BuddyCard
          name={spec.name}
          line={spec.line}
          record={spec.record}
          color={spec.color}
          tone={spec.tone}
        />
      );
    case 'pledge':
      return <PledgeCard team={spec.team} odds={spec.odds} delta={spec.delta} />;
    case 'live':
      return <LiveCard still={still} />;
    case 'streak':
      return <StreakCard id={id} />;
    case 'ghost':
      return <GhostStampCard name={spec.name} shape={spec.shape} />;
    case 'wrapped':
      return <WrappedCard id={id} />;
  }
});
