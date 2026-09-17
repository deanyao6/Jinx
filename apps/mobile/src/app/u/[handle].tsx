import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { PersonAvatar } from '@/components/PersonAvatar';
import { IconLock } from '@/components/reference/icons';
import { Screen } from '@/components/Screen';
import { StatTile } from '@/components/StatTile';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { isEmptyStats, parseStats } from '@/features/passport/format';
import {
  REPORT_REASONS,
  useBlock,
  useProfileView,
  useReport,
  useUnblock,
  type ProfileView,
} from '@/features/social/queries';
import { FollowButton } from '@/features/social/ui/FollowButton';
import { ProfilePassport } from '@/features/social/ui/ProfilePassport';
import { TeamPill } from '@/features/social/ui/TeamPill';
import { TeamTheme } from '@/theme/reference/TeamTheme';
import { useTheme } from '@/theme/ThemeProvider';

export default function ProfileScreen() {
  const theme = useTheme();
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

  const onBlock = () => {
    if (!p) return;
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
    );
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
        <EmptyState
          icon="i-lock"
          title={`You blocked @${p.handle}`}
          body="Neither of you can see the other’s passport, feed events, overlaps, or tags. Unblocking does not restore follows."
        />
        <Button
          title="Unblock"
          variant="secondary"
          loading={unblock.isPending}
          onPress={() => unblock.mutate({ userId: p.id })}
          style={{ alignSelf: 'center', marginTop: -theme.spacing.md }}
        />
      </Screen>
    );
  }
  if (!p) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Profile' }} />
        <EmptyState
          icon="i-lock"
          title="This profile isn’t available"
          body="The handle may have changed, or one of you has blocked the other. Blocked users are listed under You › Blocked users."
        />
      </Screen>
    );
  }

  const name = p.display_name?.trim() || `@${p.handle}`;
  // Their first favourite team, already in the profile payload. The whole page wears it.
  const lead = p.teams[0]?.team_id;

  const body = (
    <>
      <ProfileHeader p={p} name={name} onEdit={() => router.push('/you/edit-profile')} />
      {p.can_view ? (
        <>
          <ProfileTiles stats={p.stats} />
          <ProfilePassport stats={p.stats} name={p.is_me ? 'You' : name} />
        </>
      ) : (
        <EmptyState
          icon="i-lock"
          title="This account is private"
          body={
            p.follow_status === 'requested'
              ? 'Your request is waiting on them.'
              : 'Request to follow to see their record, stamps, and games.'
          }
        />
      )}

      {p.is_me ? null : (
        <View style={{ marginTop: theme.spacing.xl }}>
          {block.error ? <Notice tone="error">{errorMessage(block.error)}</Notice> : null}
          {reported ? <Notice tone="success">Thanks. We’ll take a look.</Notice> : null}
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
                  variant="secondary"
                  small
                  disabled={!reason}
                  loading={report.isPending}
                  onPress={() => void onSubmitReport()}
                />
                <Button title="Cancel" variant="ghost" small onPress={() => setReporting(false)} />
              </View>
            </Card>
          ) : null}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Text variant="caption" color="muted" style={{ flex: 1 }}>
                Something wrong with this account?
              </Text>
              <Button
                title="Report"
                variant="ghost"
                small
                disabled={reporting}
                onPress={() => setReporting(true)}
              />
              <Button
                title="Block"
                variant="danger"
                small
                loading={block.isPending}
                onPress={onBlock}
              />
            </View>
          </Card>
        </View>
      )}
    </>
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: `@${p.handle}` }} />
      {lead ? <TeamTheme team={lead}>{body}</TeamTheme> : body}
    </Screen>
  );
}

/** The person: ringed portrait, handle, name, their teams, and the one thing to press. */
function ProfileHeader({ p, name, onEdit }: { p: ProfileView; name: string; onEdit: () => void }) {
  const theme = useTheme();
  const meta = [p.home_city, !p.is_me && p.follows_me ? 'Follows you' : null].filter(
    (v): v is string => !!v,
  );
  return (
    <View style={{ alignItems: 'center', marginBottom: theme.spacing.lg }}>
      <PersonAvatar
        userId={p.id}
        name={p.display_name}
        handle={p.handle}
        path={p.avatar_path}
        size={80}
        ring
      />
      {/* A handle is an identifier, so it keeps its own case inside the kicker's spacing. */}
      {/* With no display name the title below is the handle, so it is not said twice. */}
      {name !== `@${p.handle}` ? (
        <Text
          variant="kicker"
          color="accent"
          style={{ marginTop: theme.spacing.md, textTransform: 'none' }}
        >
          @{p.handle}
        </Text>
      ) : null}
      <Text
        variant="h1"
        align="center"
        numberOfLines={2}
        adjustsFontSizeToFit
        accessibilityRole="header"
        // A handle keeps its own case; only a real name takes the variant's capitals.
        style={[
          { marginTop: name === `@${p.handle}` ? theme.spacing.md : 4 },
          name === `@${p.handle}` ? { textTransform: 'none' } : null,
        ]}
      >
        {name}
      </Text>
      {meta.length || p.is_private ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            columnGap: 10,
            marginTop: 6,
          }}
        >
          {meta.length ? (
            <Text variant="sub" color="muted" align="center">
              {meta.join(' · ')}
            </Text>
          ) : null}
          {p.is_private ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <IconLock size={13} color={theme.colors.muted} />
              <Text variant="sub" color="muted">
                Private
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: theme.spacing.lg, marginTop: theme.spacing.sm }}>
        <Text variant="sub" color="muted">
          <Text variant="bodyStrong">{p.followers}</Text> followers
        </Text>
        <Text variant="sub" color="muted">
          <Text variant="bodyStrong">{p.following}</Text> following
        </Text>
      </View>
      {p.teams.length ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 6,
            marginTop: theme.spacing.md,
          }}
        >
          {p.teams.map((t) => (
            <TeamPill key={t.team_id} teamId={t.team_id} label={t.name} />
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing.lg }}>
        {p.is_me ? (
          <Button title="Edit profile" variant="secondary" onPress={onEdit} />
        ) : (
          <FollowButton
            userId={p.id}
            name={name}
            status={p.follow_status}
            isPrivate={p.is_private}
            isMutual={p.is_mutual}
          />
        )}
      </View>
    </View>
  );
}

/** The counts the passport below does not already lead with. Nothing to show means no row. */
function ProfileTiles({ stats }: { stats: unknown }) {
  const theme = useTheme();
  const s = useMemo(() => parseStats(stats), [stats]);
  if (isEmptyStats(s)) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: theme.spacing.md }}>
      <StatTile label="Games" value={String(s.totals.games)} accent />
      <StatTile label="Stadiums" value={String(s.totals.venues)} />
      {s.players_seen ? <StatTile label="Players seen" value={String(s.players_seen)} /> : null}
    </View>
  );
}
