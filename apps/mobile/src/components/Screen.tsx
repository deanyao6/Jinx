import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  padded?: boolean;
};

/** Base screen wrapper: safe-area aware, themed background, optional scrolling. */
export function Screen({ children, scroll = true, style, padded = true }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const base: ViewStyle = {
    flex: 1,
    backgroundColor: theme.colors.screen,
  };
  const content: ViewStyle = {
    paddingTop: insets.top + theme.spacing.sm,
    paddingHorizontal: padded ? theme.spacing.lg : 0,
    paddingBottom: theme.spacing.xl,
  };
  if (!scroll) {
    return <View style={[base, content, style]}>{children}</View>;
  }
  return (
    <ScrollView
      style={[base, style]}
      contentContainerStyle={[content, styles.grow]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ grow: { flexGrow: 1 } });
