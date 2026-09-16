import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackHeader } from '@/components/reference/BackHeader';
import { ICONS } from '@/components/reference/icons';
import { ReferenceThemeProvider, useReferenceTheme } from '@/theme/reference/TeamTheme';
import { fontFamily } from '@/theme/fonts';

/**
 * Settings index, in the reference's visual language.
 *
 * The old Profile tab was the only way into the /you/* pages, and wiring the ported
 * screens removed it from the tab bar, so settings had no entry point at all. This is
 * that entry point. The destinations are the existing screens, which are still in the
 * old design until they are restyled (docs/interactions.md).
 */
const ROWS: { title: string; meta: string; href: Href }[] = [
  { title: 'Edit profile', meta: 'Name, handle, photo', href: '/you/edit-profile' },
  { title: 'Favorites', meta: 'Your teams and players', href: '/settings/favorites' },
  { title: 'Privacy', meta: 'Private account, seats, overlap', href: '/you/privacy' },
  { title: 'Notifications', meta: 'Your alerts', href: '/you/notifications' },
  {
    title: 'Notification settings',
    meta: 'Turn kinds on or off',
    href: '/you/notification-settings',
  },
  { title: 'Forwarding address', meta: 'Email your tickets in', href: '/you/forwarding' },
  { title: 'Blocked users', meta: 'People you have blocked', href: '/you/blocked' },
  { title: 'About', meta: 'Version, attributions, contact', href: '/you/about' },
  { title: 'Delete account', meta: 'Permanently remove your data', href: '/you/delete-account' },
];

function SettingsBody() {
  const { base } = useReferenceTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const ChevR = ICONS['i-chev-r'];
  return (
    <View style={[s.screen, { backgroundColor: base.scr, paddingTop: insets.top }]}>
      {/* Settings is reached from the Profile tab's gear, so Profile is the fallback. */}
      <BackHeader title="Settings" fallback="/profile" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={[s.card, { backgroundColor: base.card, borderColor: base.line }]}>
          {ROWS.map((row, i) => (
            <Pressable
              key={row.title}
              onPress={() => router.push(row.href)}
              accessibilityRole="button"
              accessibilityLabel={row.title}
              style={({ pressed }) => [
                s.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: base.line },
                pressed && { opacity: 0.6 },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: base.ink }]}>{row.title}</Text>
                <Text style={[s.rowMeta, { color: base.muted }]}>{row.meta}</Text>
              </View>
              <ChevR size={18} color={base.muted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export default function SettingsRoute() {
  return (
    <ReferenceThemeProvider team="none">
      <SettingsBody />
    </ReferenceThemeProvider>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowTitle: { fontSize: 15, fontFamily: fontFamily({ weight: 700 }) },
  rowMeta: { fontSize: 12.5, marginTop: 2 },
});
