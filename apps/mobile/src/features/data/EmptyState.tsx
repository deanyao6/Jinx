import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fontFamily } from '@/theme/fonts';
import { useReferenceTheme } from '@/theme/reference/TeamTheme';
import { border, radius } from '@/theme/reference/tokens';

import { useRepositoryStatus } from './context';

/**
 * What a screen shows when the repository has nothing for it.
 *
 * It lives beside the empty repository rather than in the component library because it is
 * the other half of the same decision: a screen that cannot show your data says so, in the
 * reference's own visual language — the bordered card the Games list already used for its
 * empty segments — instead of borrowing the demo account's content to fill the space.
 *
 * `loading` is passed through from the repository status, so "you have not logged anything"
 * and "your games have not arrived yet" never wear each other's words.
 */
export function EmptyState({
  /** What to say once the data has settled and there is still nothing. */
  text,
  /** Overrides the default while the user's data is still loading. */
  loadingText = 'Loading your games…',
  /**
   * Overrides the repository's own status, for a screen whose data is a separate read.
   * Relive is the case: it reads one game's story steps directly, so the repository can be
   * settled while the thing this pane is about has not arrived.
   */
  loading: loadingOverride,
  children,
}: {
  text: string;
  loadingText?: string;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  const { base } = useReferenceTheme();
  const status = useRepositoryStatus() === 'loading';
  const loading = loadingOverride ?? status;
  return (
    <View
      accessibilityRole="summary"
      style={[s.pane, { borderColor: base.line, backgroundColor: base.card }]}
    >
      <Text style={[s.text, { color: base.muted }]}>{loading ? loadingText : text}</Text>
      {loading ? null : children}
    </View>
  );
}

const s = StyleSheet.create({
  // `.fx-row`'s card, with the Games list's own empty-pane padding.
  pane: {
    borderWidth: border.card,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 2,
    marginBottom: 8,
  },
  text: { fontSize: 12.5, fontFamily: fontFamily(), lineHeight: 18 },
});
