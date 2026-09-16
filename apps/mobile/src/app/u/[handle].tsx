import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Loading } from '@/components/Loading';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Notice, errorMessage } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import {
  REPORT_REASONS,
  useBlock,
  useProfileView,
  useReport,
  useUnblock,
} from '@/features/social/queries';
import { Avatar } from '@/features/social/ui/Avatar';
import { FollowButton } from '@/features/social/ui/FollowButton';
import { ProfilePassport } from '@/features/social/ui/ProfilePassport';
import { useTheme } from '@/theme/ThemeProvider';

export default function ProfileScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const profile = useProfileView(handle);
  const block = useBlock();
  const unblock = useUnblock();
  const report = useReport();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [detail, setDetail] = useState('');
  const [reported, setReported] = useState(false);

  const p = profile.data;

  const onMenu = () => {
    if (!p) return;
    Alert.alert(p.display_name || `@${p.handle}`, undefined, [
      { text: 'Report', onPress: () => setReporting(true) },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            `Block @${p.handle}?`,
            'You stop following each other. They cannot see your passport, feed, or tags, and you will not see theirs. You can unblock from You › Blocked users.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Block',
                style: 'destructive',
                onPress: () => block.mutate({ userId: p.id }, { onSuccess: () => router.back() }),
              },
            ],
          ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const onSubmitReport = async () => {
    if (!p || !reason) return;
    const text = detail.trim() ? `${reason}: ${detail.trim()}` : reason;
    try {
      await report.mutateAsync({ targetType: 'user', targetId: p.id, reason: text });
      setReported(true);
      setReporting(false);
    } catch {
      // surfaced via report.error
    }
  };

  if (profile.isPending) return <Loading label="Loading profile" />;
  if (profile.isError) {
    return (
      <Screen>
        <ErrorNotice error={profile.error} onRetry={profile.refetch} />
      </Screen>
    );
  }
  if (p?.blocked_by_me) {
    return (
      <Screen>
        <Stack.Screen options={{ title: `@${p.handle}` }} />
        {unblock.error ? <ErrorNotice error={unblock.error} /> : null}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="ban" size={18} color={c.muted} />
            <Text variant="h2">You blocked @{p.handle}</Text>
          </View>
          <Text variant="sub" color="muted" style={{ marginTop: theme.spacing.sm }}>
            Neither of you can see the other’s passport, feed events, overlaps, or tags. Unblocking
            does not restore follows.
          </Text>
          <Button
            title="Unblock"
            variant="secondary"
            small
            loading={unblock.isPending}
            onPress={() => unblock.mutate({ userId: p.id })}
            style={{ alignSelf: 'flex-start', marginTop: theme.spacing.md }}
          />
        </Card>
      </Screen>
    );
  }
  if (!p) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Profile' }} />
        <Notice>
          <Text variant="sub">This profile isn’t available.</Text>
          <Text variant="caption" color="muted" style={{ marginTop: 4 }}>
            The handle may have changed, or one of you has blocked the other. Blocked users are
            listed under You › Blocked users.
          </Text>
        </Notice>
      </Screen>
    );
  }

  const name = p.display_name?.trim() || `@${p.handle}`;

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: `@${p.handle}`,
          headerRight: p.is_me
            ? undefined
            : () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="More options"
                  onPress={onMenu}
                  hitSlop={8}
                >
                  <Ionicons name="ellipsis-horizontal" size={22} color={c.ink} />
                </Pressable>
              ),
        }}
      />
      {block.error ? <Notice tone="error">{errorMessage(block.error)}</Notice> : null}
      {reported ? <Notice tone="success">Thanks. We’ll take a look.</Notice> : null}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={name} size={52} />
          <View style={{ flex: 1 }}>
            <Text variant="h2" numberOfLines={2}>
              {name}
            </Text>
            <Text variant="sub" color="muted">
              @{p.handle}
              {p.home_city ? ` · ${p.home_city}` : ''}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.lg, marginTop: theme.spacing.md }}>
          <Text variant="sub">
            <Text variant="bodyStrong">{p.followers}</Text> followers
          </Text>
          <Text variant="sub">
            <Text variant="bodyStrong">{p.following}</Text> following
          </Text>
        </View>
        {p.teams.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: theme.spacing.md }}>
            {p.teams.map((t) => (
              <Chip key={t.team_id} label={t.name} />
            ))}
          </View>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            marginTop: theme.spacing.md,
          }}
        >
          {p.is_me ? (
            <Button
              title="Edit profile"
              variant="secondary"
              small
              onPress={() => router.push('/you/edit-profile')}
              style={{ alignSelf: 'flex-start' }}
            />
          ) : (
            <FollowButton
              userId={p.id}
              name={name}
              status={p.follow_status}
              isPrivate={p.is_private}
              isMutual={p.is_mutual}
              small
            />
          )}
          {!p.is_me && p.follows_me ? (
            <Text variant="caption" color="muted">
              Follows you
            </Text>
          ) : null}
          {p.is_private ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="lock-closed" size={13} color={c.muted} />
              <Text variant="caption" color="muted">
                Private
              </Text>
            </View>
          ) : null}
        </View>
      </Card>

      {reporting ? (
        <Card label={`Report @${p.handle}`}>
          {report.error ? <Notice tone="error">{errorMessage(report.error)}</Notice> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {REPORT_REASONS.map((r) => (
              <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
            ))}
          </View>
          <TextField
            placeholder="Anything else we should know (optional)"
            value={detail}
            onChangeText={setDetail}
            multiline
            maxLength={400}
            style={{ minHeight: 60, textAlignVertical: 'top' }}
            containerStyle={{ marginTop: theme.spacing.sm }}
            accessibilityLabel="Report details"
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button
              title="Send report"
              small
              disabled={!reason}
              loading={report.isPending}
              onPress={() => void onSubmitReport()}
            />
            <Button title="Cancel" variant="ghost" small onPress={() => setReporting(false)} />
          </View>
        </Card>
      ) : null}

      {p.can_view ? (
        <ProfilePassport stats={p.stats} name={p.is_me ? 'You' : name} />
      ) : (
        <Card label="Passport">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="lock-closed" size={16} color={c.muted} />
            <Text variant="sub" color="muted" style={{ flex: 1 }}>
              This account is private.{' '}
              {p.follow_status === 'requested'
                ? 'Your request is waiting on them.'
                : 'Request to follow to see their record, stamps, and games.'}
            </Text>
          </View>
        </Card>
      )}
    </Screen>
  );
}
