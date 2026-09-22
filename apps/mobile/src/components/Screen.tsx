import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { useIsUnderHeader } from './subPageHeader';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  padded?: boolean;
  /** Overrides what the layout says, for a screen that hides its stack's header. */
  underHeader?: boolean;
  /** The scroll view, for a page that has to move itself (a deep link to a section). */
  scrollRef?: React.Ref<ScrollView>;
};

/** Base screen wrapper: safe-area aware, themed background, optional scrolling. */
export function Screen({
  children,
  scroll = true,
  style,
  padded = true,
  underHeader,
  scrollRef,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const headed = useIsUnderHeader();
  const below = underHeader ?? headed;
  const base: ViewStyle = {
    flex: 1,
    backgroundColor: theme.colors.screen,
  };
  const content: ViewStyle = {
    // Under a navigator header the content already starts below it; adding the status bar
    // inset again left a band of nothing at the top of every sub page.
    paddingTop: (below ? 0 : insets.top) + theme.spacing.sm,
    paddingHorizontal: padded ? theme.spacing.lg : 0,
    paddingBottom: theme.spacing.xl + insets.bottom,
  };
  if (!scroll) {
    return <View style={[base, content, style]}>{children}</View>;
  }
  return (
    <ScrollView
      ref={scrollRef}
      style={[base, style]}
      contentContainerStyle={[content, styles.grow]}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ grow: { flexGrow: 1 } });
