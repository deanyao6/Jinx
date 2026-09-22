import React from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { IconBolt } from '@/components/reference/icons';

import { CARD_META, CARD_TITLE, WALL, wallText } from '../styles';
import { CardShell } from './CardShell';
import { GradientFill } from './GradientFill';

/** `@keyframes pop`: `0%,70%,100%{none} 76%{scale(1.045)} 82%{scale(.995)}`, 6s, ease-in-out. */
export const POP = {
  periodMs: 6000,
  restMs: 4200,
  upMs: 360,
  downMs: 360,
  settleMs: 1080,
  peak: 1.045,
  dip: 0.995,
} as const;

/**
 * `.moment.pop`: a gold-washed card with a bolt in the corner that swells once every six
 * seconds. The bolt is `i-bolt` from the reference icon set at 30px, in brass at 50%.
 */
export const MomentCard = React.memo(function MomentCard({
  id,
  tag,
  line,
  sub,
  still,
}: {
  id: string;
  tag: string;
  line: string;
  sub: string;
  still: boolean;
}) {
  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (still) {
      scale.value = 1;
      return;
    }
    scale.value = 1;
    const ease = Easing.inOut(Easing.ease);
    scale.value = withRepeat(
      withSequence(
        withDelay(POP.restMs, withTiming(POP.peak, { duration: POP.upMs, easing: ease })),
        withTiming(POP.dip, { duration: POP.downMs, easing: ease }),
        withTiming(1, { duration: POP.settleMs, easing: ease }),
      ),
      -1,
      false,
    );
  }, [scale, still]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <CardShell style={{ borderColor: 'rgba(217,182,95,0.55)' }}>
        <GradientFill
          id={`m-${id}`}
          angle={140}
          stops={[
            { offset: 0, color: WALL.brass, opacity: 0.38 },
            { offset: 1, color: WALL.white, opacity: 0.06 },
          ]}
        />
        <Text
          allowFontScaling={false}
          style={wallText({
            size: 8.5,
            line: 11.05,
            weight: 850,
            color: WALL.brass,
            spacing: 1.19,
          })}
        >
          {tag}
        </Text>
        <Text allowFontScaling={false} style={[CARD_TITLE, { marginBottom: 2 }]}>
          {line}
        </Text>
        <Text allowFontScaling={false} style={CARD_META}>
          {sub}
        </Text>
        <View pointerEvents="none" style={{ position: 'absolute', right: 6, bottom: 4 }}>
          <IconBolt size={30} color="rgba(217,182,95,0.5)" />
        </View>
      </CardShell>
    </Animated.View>
  );
});
