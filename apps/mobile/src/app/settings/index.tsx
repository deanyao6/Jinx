import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import type { IconName } from '@/components/reference/icons';
import { Row } from '@/components/Row';
import { SectionHeader } from '@/components/SectionHeader';
import { useExportData } from '@/features/account/queries';
import { IdentityCard } from '@/features/account/ui/IdentityCard';
import { SettingsFrame } from '@/features/account/ui/SettingsFrame';
import { useSignOut } from '@/features/auth/hooks';
import { useProfile } from '@/features/profile/queries';
import { features } from '@/lib/env';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Settings index: who you are, then two cards of icon rows, in your team's colour.
 *
 * The old Profile tab was the only way into the /you/* pages, and wiring the ported
 * screens removed it from the tab bar, so settings had no entry point at all. This is
 * that entry point (docs/interactions.md, docs/subpage-style.md).
 */
type SettingsRow = { title: string; meta: string; href: Href; icon: IconName };

/**
 * `forwarding` is off until a real inbound domain exists (features.forwarding), so nobody is
 * told to send their tickets to a placeholder address.
 */
export function settingsRows(opts: { forwarding: boolean }): SettingsRow[] {
  const rows: (SettingsRow | null)[] = [
    {
      title: 'Edit profile',
      meta: 'Name, handle, photo',
      href: '/you/edit-profile',
      icon: 'i-user',
    },
    {
      title: 'Favorites',
      meta: 'Your teams, players and app color',
      href: '/settings/favorites',
      icon: 'i-spark',
    },
    {
      title: 'Privacy',
      meta: 'Private account, seats, overlap',
      href: '/you/privacy',
      icon: 'i-lock',
    },
    { title: 'Notifications', meta: 'Your alerts', href: '/you/notifications', icon: 'i-bell' },
    {
      title: 'Notification settings',
      meta: 'Turn kinds on or off',
      href: '/you/notification-settings',
      icon: 'i-gear',
    },
    opts.forwarding
      ? {
          title: 'Forwarding address',
          meta: 'Email your tickets in',
          href: '/you/forwarding',
          icon: 'i-ticket',
        }
      : null,
    {
      title: 'Blocked users',
      meta: 'People you have blocked',
      href: '/you/blocked',
      icon: 'i-eye',
    },
    {
      title: 'About',
      meta: 'Version, attributions, contact',
      href: '/you/about',
      icon: 'i-book',
    },
  ];
  return rows.filter((r): r is SettingsRow => r !== null);
}

export default function SettingsRoute() {
  const theme = useTheme();
  const router = useRouter();
  const signOut = useSignOut();
  const exportData = useExportData();
  const profile = useProfile();
  const me = profile.data;
  const handle = me?.handle;

  const onSignOut = () => {
    Alert.alert('Sign out?', 'Your passport stays saved to your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  // Rows that act instead of navigating. They were on the old You tab, which nothing links to
  // since the reference tab bar replaced it, so for a while there was no way to sign out at all.
  const dataRows: {
    title: string;
    meta: string;
    icon: IconName;
    onPress: () => void;
    busy?: boolean;
  }[] = [
    ...(handle
      ? [
          {
            title: 'Public profile',
            meta: 'See what other people see',
            icon: 'i-ext' as const,
            onPress: () => router.push(`/u/${handle}` as Href),
          },
        ]
      : []),
    {
      title: 'Export my data',
      meta: exportData.isError
        ? 'That did not work. Tap to try again'
        : 'Everything on your account, as a JSON file',
      icon: 'i-share',
      onPress: () => exportData.mutate(),
      busy: exportData.isPending,
    },
    {
      title: 'Delete account',
      meta: 'Permanently remove your data',
      icon: 'i-flag',
      onPress: () => router.push('/you/delete-account'),
    },
  ];
  const rows = settingsRows({ forwarding: features.forwarding });

  return (
    // Settings is reached from the Profile tab's gear, so Profile is the fallback.
    <SettingsFrame title="Settings" fallback="/profile">
      {me && handle ? (
        <IdentityCard name={me.display_name ?? ''} handle={handle} note={me.home_city} />
      ) : null}

      <SectionHeader title="Account" />
      <Card>
        {rows.map((row) => (
          <Row
            key={row.title}
            icon={row.icon}
            title={row.title}
            subtitle={row.meta}
            chevron
            accessibilityLabel={row.title}
            onPress={() => router.push(row.href)}
          />
        ))}
      </Card>

      <SectionHeader title="Your data" />
      <Card>
        {dataRows.map((row) => (
          <Row
            key={row.title}
            icon={row.icon}
            title={row.title}
            subtitle={row.meta}
            chevron={!row.busy}
            right={row.busy ? <ActivityIndicator color={theme.accent.text} /> : null}
            accessibilityLabel={row.title}
            onPress={row.busy ? undefined : row.onPress}
          />
        ))}
      </Card>

      <Button
        title="Sign out"
        variant="ghost"
        accessibilityLabel="Sign out"
        onPress={onSignOut}
        style={{ marginTop: theme.spacing.sm }}
      />
    </SettingsFrame>
  );
}
