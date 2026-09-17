import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { PageIntro } from '@/components/PageIntro';
import { Screen } from '@/components/Screen';
import { formatGameDate } from '@/lib/format';
import { useAcceptRequest, useDeclineRequest, useFollowRequests } from '@/features/social/queries';
import { PersonRow } from '@/features/social/ui/PersonRow';
import { useTheme } from '@/theme/ThemeProvider';

export default function RequestsScreen() {
  const theme = useTheme();
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
          icon="i-users"
          title="No requests"
          body="When your account is private, people who want to follow you land here."
        />
      ) : null}
      {requests.data && requests.data.length > 0 ? (
        <>
          <PageIntro
            kicker="Wants to follow you"
            title={requests.data.length === 1 ? '1 request' : `${requests.data.length} requests`}
          />
          <Card>
            {requests.data.map((r) => {
              const name = r.profile?.display_name?.trim() || `@${r.profile?.handle ?? 'someone'}`;
              const busy =
                (accept.isPending && accept.variables?.followerId === r.follower_id) ||
                (decline.isPending && decline.variables?.followerId === r.follower_id);
              return (
                <PersonRow
                  key={r.follower_id}
                  userId={r.follower_id}
                  name={name}
                  handle={r.profile?.handle}
                  avatarPath={r.profile?.avatar_path}
                  caption={`${r.profile ? `@${r.profile.handle} · ` : ''}${formatGameDate(
                    r.created_at,
                    { withYear: true },
                  )}`}
                  onPressName={() => r.profile && router.push(`/u/${r.profile.handle}`)}
                >
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
                </PersonRow>
              );
            })}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
