import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { ICONS } from '@/components/reference/icons';
import { fontFamily } from '@/theme/fonts';
import { useReferenceTheme } from '@/theme/reference/TeamTheme';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The back control every non-tab screen needs.
 *
 * Navigation used to rely on the iOS edge-swipe gesture and, on the screens inside a
 * nested group stack, on a navigator header that draws no back button because the screen
 * is the first entry in its own stack. Both are invisible. The swipe still works; this
 * is the arrow next to it.
 *
 * The four tab routes deliberately do not use any of this. They are roots, and the
 * reference's own tab bar is their navigation.
 */

/**
 * `back()` when there is something to pop, otherwise `replace(fallback)`.
 *
 * A deep link (or a push notification, or a cold start into a share URL) opens a screen
 * with an empty history, and a back button that calls `router.back()` there does nothing
 * at all, which is the trap Dean hit. The fallback sends you to a sensible root instead.
 */
export function useGoBack(fallback: Href = '/') {
  const router = useRouter();
  return React.useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}

/** Shared accessibility contract, so every back control is found the same way in tests. */
export const BACK_A11Y = {
  accessibilityRole: 'button',
  accessibilityLabel: 'Back',
} as const;

type BackHeaderProps = {
  /** Centred between the back button and the right slot. */
  title?: string;
  /** Where to go when there is no history to pop. */
  fallback?: Href;
  /** Optional right-hand control. The slot is reserved either way so the title stays centred. */
  right?: React.ReactNode;
  style?: ViewStyle;
};

/**
 * The reference's header row: a 36pt circular icon button holding `i-chev-l`, the screen
 * title, and an optional right-hand slot. Lifted out of `app/settings/index.tsx`, which
 * had it inline.
 *
 * Requires a `<ReferenceThemeProvider>` above it, like every other reference component.
 */
export function BackHeader({ title, fallback = '/', right, style }: BackHeaderProps) {
  const { base } = useReferenceTheme();
  const goBack = useGoBack(fallback);
  const ChevL = ICONS['i-chev-l'];
  return (
    <View style={[s.head, style]}>
      <Pressable
        {...BACK_A11Y}
        onPress={goBack}
        hitSlop={8}
        style={({ pressed }) => [s.ib, { backgroundColor: base.card }, pressed && { opacity: 0.6 }]}
      >
        <ChevL size={18} color={base.ink} />
      </Pressable>
      <Text style={[s.title, { color: base.ink }]} numberOfLines={1}>
        {title ?? ''}
      </Text>
      {/* Reserved even when empty: the title is centred between two 36pt slots. */}
      <View style={s.slot}>{right}</View>
    </View>
  );
}

/**
 * The same control for screens still on the old design system.
 *
 * It lives here rather than in a second file so there is one place to look for "the back
 * button", but it deliberately reads the old theme and uses the old icon set: SPEC.md 8.8
 * wants each screen coherent with itself, and a reference-styled chevron dropped onto a
 * pre-redesign screen reads as half-converted. When those screens are restyled this goes
 * away and they use `BackHeader`.
 *
 * Passed as `headerLeft` by the group layouts whose screens keep a navigator header, and
 * rendered inline by the few old screens that draw no header at all.
 */
export function LegacyBackButton({ fallback = '/' }: { fallback?: Href }) {
  const theme = useTheme();
  const goBack = useGoBack(fallback);
  return (
    <Pressable
      {...BACK_A11Y}
      onPress={goBack}
      hitSlop={8}
      style={({ pressed }) => [s.legacy, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name="chevron-back" size={26} color={theme.colors.ink} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 16 },
  ib: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The same title the navigator header draws on every other sub page (subPageHeader.tsx).
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 21,
    fontFamily: fontFamily({ width: 62, weight: 900 }),
  },
  slot: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  legacy: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
});
