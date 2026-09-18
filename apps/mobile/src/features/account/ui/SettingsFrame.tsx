import type { Href } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackHeader } from '@/components/reference/BackHeader';
import { ReferenceThemeProvider, useOptionalReferenceTheme } from '@/theme/reference/TeamTheme';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  title: string;
  /** Where Back goes when the screen was opened cold. */
  fallback: Href;
  children: React.ReactNode;
  /** Actions that stay in reach under a long list, above the home indicator. */
  footer?: React.ReactNode;
};

/**
 * The frame of the screens under /settings, which draw their own `BackHeader` rather than
 * sitting under a navigator header.
 *
 * These screens used to pin themselves to the neutral theme, which is why Settings was the
 * one grey corner of the app. The frame takes whichever team is already in scope instead,
 * which in the app is the person's own (features/teams/AccentRoot). Only when nothing is in
 * scope at all, as in a unit test that renders the route by itself, does it supply the
 * neutral provider that `BackHeader` and `TeamTheme` need above them.
 */
export function SettingsFrame(props: Props) {
  const scoped = useOptionalReferenceTheme();
  if (scoped) return <Frame {...props} />;
  return (
    <ReferenceThemeProvider>
      <Frame {...props} />
    </ReferenceThemeProvider>
  );
}

function Frame({ title, fallback, children, footer }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top,
        paddingHorizontal: theme.spacing.lg,
        backgroundColor: theme.colors.screen,
      }}
    >
      <BackHeader title={title} fallback={fallback} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: footer ? theme.spacing.md : insets.bottom + theme.spacing.xl,
        }}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={{
            paddingTop: theme.spacing.md,
            paddingBottom: insets.bottom + theme.spacing.md,
            gap: theme.spacing.sm,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
