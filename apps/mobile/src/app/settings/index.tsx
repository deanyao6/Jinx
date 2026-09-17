import { useRouter, type Href } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackHeader } from '@/components/reference/BackHeader';
import { ICONS } from '@/components/reference/icons';
import { useExportData } from '@/features/account/queries';
import { useSignOut } from '@/features/auth/hooks';
import { useProfile } from '@/features/profile/queries';
import { features } from '@/lib/env';
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
type SettingsRow = { title: string; meta: string; href: Href };

/**
 * `forwarding` is off until a real inbound domain exists (features.forwarding), so nobody is
 * told to send their tickets to a placeholder address.
 */
export function settingsRows(opts: { forwarding: boolean }): SettingsRow[] {
  const rows: (SettingsRow | null)[] = [
    { title: 'Edit profile', meta: 'Name, handle, photo', href: '/you/edit-profile' },
    { title: 'Favorites', meta: 'Your teams and players', href: '/settings/favorites' },
    { title: 'Privacy', meta: 'Private account, seats, overlap', href: '/you/privacy' },
    { title: 'Notifications', meta: 'Your alerts', href: '/you/notifications' },
    {
      title: 'Notification settings',
      meta: 'Turn kinds on or off',
      href: '/you/notification-settings',
    },
    opts.forwarding
      ? { title: 'Forwarding address', meta: 'Email your tickets in', href: '/you/forwarding' }
      : null,
    { title: 'Blocked users', meta: 'People you have blocked', href: '/you/blocked' },
    { title: 'About', meta: 'Version, attributions, contact', href: '/you/about' },
  ];
  return rows.filter((r): r is SettingsRow => r !== null);
}

function SettingsBody() {
  const { base } = useReferenceTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const ChevR = ICONS['i-chev-r'];
  const signOut = useSignOut();
  const exportData = useExportData();
  const profile = useProfile();
  const handle = profile.data?.handle;

  const onSignOut = () => {
    Alert.alert('Sign out?', 'Your passport stays saved to your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  // Rows that act instead of navigating. They were on the old You tab, which nothing links to
  // since the reference tab bar replaced it, so for a while there was no way to sign out at all.
  const dataRows: { title: string; meta: string; onPress: () => void; busy?: boolean }[] = [
    ...(handle
      ? [
          {
            title: 'Public profile',
            meta: 'See what other people see',
            onPress: () => router.push(`/u/${handle}` as Href),
          },
        ]
      : []),
    {
      title: 'Export my data',
      meta: exportData.isError
        ? 'That did not work. Tap to try again'
        : 'Everything on your account, as a JSON file',
      onPress: () => exportData.mutate(),
      busy: exportData.isPending,
    },
    {
      title: 'Delete account',
      meta: 'Permanently remove your data',
      onPress: () => router.push('/you/delete-account'),
    },
  ];
  const rows = settingsRows({ forwarding: features.forwarding });

  return (
    <View style={[s.screen, { backgroundColor: base.scr, paddingTop: insets.top }]}>
      {/* Settings is reached from the Profile tab's gear, so Profile is the fallback. */}
      <BackHeader title="Settings" fallback="/profile" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={[s.card, { backgroundColor: base.card, borderColor: base.line }]}>
          {rows.map((row, i) => (
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

        <Text style={[s.section, { color: base.muted }]}>YOUR DATA</Text>
        <View style={[s.card, { backgroundColor: base.card, borderColor: base.line }]}>
          {dataRows.map((row, i) => (
            <Pressable
              key={row.title}
              onPress={row.onPress}
              disabled={row.busy}
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
              {row.busy ? <ActivityIndicator /> : <ChevR size={18} color={base.muted} />}
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={onSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={({ pressed }) => [
            s.signOut,
            { backgroundColor: base.card, borderColor: base.line },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={[s.signOutLabel, { color: base.bad }]}>Sign out</Text>
        </Pressable>
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
  section: {
    fontSize: 11.5,
    letterSpacing: 0.8,
    fontFamily: fontFamily({ weight: 700 }),
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 4,
  },
  signOut: {
    marginTop: 22,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  signOutLabel: { fontSize: 15, fontFamily: fontFamily({ weight: 700 }) },
});
