import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { formatGameDate } from '@/lib/format';
import { useAcceptRequest, useDeclineRequest, useFollowRequests } from '@/features/social/queries';
import { Avatar } from '@/features/social/ui/Avatar';
import { useTheme } from '@/theme/ThemeProvider';

export default function RequestsScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const requests = useFollowRequests();
  const accept = useAcceptRequest();
  const decline = useDeclineRequest();
  const error = accept.error ?? decline.error;

  return (
    <Screen>
      {error ? <Notice tone="error">{errorMessage(error)}</Notice> : null}
      {requests.isPending ? <Loading /> : null}
      {requests.isError ? <ErrorNotice error={requests.error} onRetry={requests.refetch} /> : null}
      {requests.data && requests.data.length === 0 ? (
        <EmptyState
          title="No requests"
          body="When your account is private, people who want to follow you land here."
        />
      ) : null}
      {requests.data && requests.data.length > 0 ? (
        <Card label="Wants to follow you">
          {requests.data.map((r, i) => {
            const name = r.profile?.display_name?.trim() || `@${r.profile?.handle ?? 'someone'}`;
            const busy =
              (accept.isPending && accept.variables?.followerId === r.follower_id) ||
              (decline.isPending && decline.variables?.followerId === r.follower_id);
            return (
              <View
                key={r.follower_id}
                style={{
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: c.line,
                  gap: theme.spacing.sm,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={name} />
                  <View style={{ flex: 1 }}>
                    <Text
                      variant="bodyStrong"
                      numberOfLines={1}
                      accessibilityRole="link"
                      onPress={() => r.profile && router.push(`/u/${r.profile.handle}`)}
                    >
                      {name}
                    </Text>
                    <Text variant="caption" color="muted">
                      {r.profile ? `@${r.profile.handle} · ` : ''}
                      {formatGameDate(r.created_at, { withYear: true })}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <Button
                    title="Accept"
                    small
                    loading={busy}
                    onPress={() => accept.mutate({ followerId: r.follower_id })}
                  />
                  <Button
                    title="Decline"
                    variant="ghost"
                    small
                    disabled={busy}
                    onPress={() => decline.mutate({ followerId: r.follower_id })}
                  />
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}
