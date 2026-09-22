import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fontFamily } from '@/theme/fonts';

import {
  FALLBACK_CARDS,
  Headline,
  localToday,
  readWallCache,
  refreshWallCache,
  Scrim,
  useReduceMotion,
  Wall,
  WALL,
  type WallGame,
} from './wall';

/**
 * The welcome screen, as drawn: the wall behind, the scrim, and the copy in front
 * (`design/welcome-reference.html`). The sign-in controls are passed in as children so the
 * route owns the auth flow and the parity harness can mount the same screen without it.
 *
 * Pinned dark in both appearances, as the reference is. `frozen` forces the bundled six cards
 * and holds every loop at phase zero, which is what a byte-comparable screenshot needs; the
 * parity harness always sets it.
 *
 * Reading order for VoiceOver is the headline, then the children (the buttons), then the age
 * line. The wall is hidden from it entirely.
 */
export function WelcomeArt({
  frozen = false,
  children,
}: {
  frozen?: boolean;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const still = frozen || reduceMotion;
  const games = useWallGames(frozen);
  const today = React.useMemo(() => localToday(), []);

  return (
    <View style={{ flex: 1, backgroundColor: WALL.scr }} testID="welcome-art">
      {games ? <Wall games={games} today={today} still={still} /> : null}
      <Scrim />
      {/* `.body`: `padding: 0 22px 22px`, a spacer, then the copy at the bottom. The bottom
          padding is the reference's 22 or the home indicator's inset, whichever is larger. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { paddingHorizontal: 22, paddingBottom: Math.max(22, insets.bottom) },
        ]}
      >
        <View style={{ flex: 1 }} />
        <Wordmark />
        <Headline still={still} />
        <Text
          style={{
            fontFamily: fontFamily({ width: 100, weight: 400 }),
            fontSize: 13.5,
            lineHeight: 19.575,
            color: 'rgba(255,255,255,0.6)',
            marginBottom: 16,
          }}
        >
          You were there. Prove it.
        </Text>
        {children}
        <Text
          style={{
            fontFamily: fontFamily({ width: 100, weight: 400 }),
            fontSize: 11.5,
            lineHeight: 12,
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'center',
            marginTop: 10,
          }}
        >
          You must be 13 or older to use Jinx.
        </Text>
      </View>
    </View>
  );
}

/**
 * `.word`: JINX at 62px, weight 900, width 62, `line-height:.82`, `letter-spacing:.01em`.
 *
 * A line box shorter than the glyphs is what `.82` means, and React Native clips a Text to
 * its line height, so the Text keeps its natural line and is offset up by CSS's negative
 * half-leading, exactly as `components/reference/TightText` does for the Passport wordmark.
 * Archivo's content height is 1.088em (hhea ascent 878, descent 210).
 */
function Wordmark() {
  const size = 62;
  const lineBox = size * 0.82;
  const offset = (lineBox - 1.088 * size) / 2;
  return (
    <View style={{ height: lineBox }}>
      <Text
        allowFontScaling={false}
        accessibilityRole="header"
        accessibilityLabel="Jinx"
        style={{
          fontFamily: fontFamily({ width: 62, weight: 900 }),
          fontSize: size,
          letterSpacing: 0.62,
          color: WALL.white,
          marginTop: offset,
        }}
      >
        JINX
      </Text>
    </View>
  );
}

/**
 * Which six games to draw: the bundled set when frozen, otherwise the cached payload if it
 * is valid and fresh, else the bundled set. The cache is read before the wall mounts, so it
 * never draws one set and then swaps to another; a refresh runs after, in the background,
 * and whatever it fetches waits for the next launch.
 */
function useWallGames(frozen: boolean): readonly WallGame[] | null {
  const [games, setGames] = React.useState<readonly WallGame[] | null>(
    frozen ? FALLBACK_CARDS : null,
  );
  React.useEffect(() => {
    if (frozen) return;
    let cancelled = false;
    readWallCache().then((cached) => {
      if (cancelled) return;
      setGames(cached ? cached.cards : FALLBACK_CARDS);
      void refreshWallCache();
    });
    return () => {
      cancelled = true;
    };
  }, [frozen]);
  return games;
}
