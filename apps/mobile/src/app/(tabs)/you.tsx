import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useExportData } from '@/features/account/queries';
import { useSignOut } from '@/features/auth/hooks';
import { useFavoriteTeams, useProfile } from '@/features/profile/queries';
import { useTheme } from '@/theme/ThemeProvider';

export default function YouScreen() {
  const theme = useTheme();
  const router = useRouter();
  const profile = useProfile();
  const favorites = useFavoriteTeams();
  const signOut = useSignOut();
  const exportData = useExportData();

  const onSignOut = () => {
    Alert.alert('Sign out?', 'Your passport stays saved to your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const p = profile.data;

  return (
    <Screen>
      <Text variant="h1" style={{ marginBottom: theme.spacing.md }}>
        You
      </Text>
      {profile.isPending ? <Loading /> : null}
      {profile.isError ? <ErrorNotice error={profile.error} onRetry={profile.refetch} /> : null}
      {exportData.isError ? <ErrorNotice error={exportData.error} /> : null}
      {p ? (
        <Card>
          <Text variant="h2">{p.display_name || 'Your name'}</Text>
          <Text color="muted" variant="sub">
            @{p.handle}
          </Text>
          {p.home_city ? (
            <Text color="muted" variant="sub">
              {p.home_city}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: theme.spacing.md }}>
            {(favorites.data ?? []).map((t) => (
              <Chip key={t.id} label={t.name} />
            ))}
            {favorites.data && favorites.data.length === 0 ? (
              <Text variant="caption" color="muted">
                No favorite teams yet.
              </Text>
            ) : null}
          </View>
          <View
            style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}
          >
            <Button
              title="Edit profile"
              variant="secondary"
              small
              onPress={() => router.push('/you/edit-profile')}
            />
            <Button
              title="Public preview"
              variant="ghost"
              small
              accessibilityLabel="Preview your public profile"
              onPress={() => router.push(`/u/${p.handle}`)}
            />
          </View>
        </Card>
      ) : null}

      <Card label="Settings">
        <Row
          title="Privacy"
          subtitle="Private account, seat sharing, overlap"
          first
          chevron
          onPress={() => router.push('/you/privacy')}
        />
        <Row
          title="Forwarding address"
          subtitle="Copy, rotate, and verified sender emails"
          chevron
          onPress={() => router.push('/you/forwarding')}
        />
        <Row
          title="Notifications"
          subtitle="Your alerts and what to send"
          chevron
          onPress={() => router.push('/you/notifications')}
        />
        <Row
          title="Notification settings"
          subtitle="Turn kinds on or off"
          chevron
          onPress={() => router.push('/you/notification-settings')}
        />
        <Row
          title="Blocked users"
          subtitle="People you have blocked"
          chevron
          onPress={() => router.push('/you/blocked')}
        />
      </Card>

      <Card label="Your data">
        <Row
          title="Export my data"
          subtitle="Everything on your account as a JSON file"
          first
          onPress={() => exportData.mutate()}
          right={
            <Button
              title="Export"
              variant="ghost"
              small
              loading={exportData.isPending}
              onPress={() => exportData.mutate()}
            />
          }
        />
        <Row
          title="Delete account"
          subtitle="Removes everything, permanently"
          chevron
          onPress={() => router.push('/you/delete-account')}
        />
        <Row
          title="About"
          subtitle="Version, data attributions, terms, privacy, contact"
          chevron
          onPress={() => router.push('/you/about')}
        />
      </Card>

      <Text variant="caption" color="muted" style={{ marginBottom: theme.spacing.md }}>
        Records use the teams you follow today, not the teams you followed on game day. Change a
        favorite and your history recolors.
      </Text>

      <Button title="Sign out" variant="danger" onPress={onSignOut} />
    </Screen>
  );
}
