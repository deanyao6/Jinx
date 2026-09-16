import { Stack, useRouter } from 'expo-router';
import React from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useBlockedUsers, useUnblock } from '@/features/social/queries';
import { formatGameDate } from '@/lib/format';

export default function BlockedUsersScreen() {
  const router = useRouter();
  const blocked = useBlockedUsers();
  const unblock = useUnblock();
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Blocked users' }} />
      {unblock.error ? <ErrorNotice error={unblock.error} /> : null}
      {blocked.isPending ? <Loading /> : null}
      {blocked.isError ? <ErrorNotice error={blocked.error} onRetry={blocked.refetch} /> : null}
      {blocked.data && blocked.data.length === 0 ? (
        <EmptyState
          title="Nobody blocked"
          body="Block someone from the menu on their profile. They vanish from your feed, overlaps, and tags, and you from theirs."
        />
      ) : null}
      {blocked.data && blocked.data.length > 0 ? (
        <>
          <Card>
            {blocked.data.map((b, i) => (
              <Row
                key={b.user_id}
                first={i === 0}
                title={b.display_name?.trim() || `@${b.handle}`}
                subtitle={`@${b.handle} · blocked ${formatGameDate(b.blocked_at, { withYear: true })}`}
                onPress={() => router.push(`/u/${b.handle}`)}
                right={
                  <Button
                    title="Unblock"
                    variant="ghost"
                    small
                    loading={unblock.isPending && unblock.variables?.userId === b.user_id}
                    onPress={() => unblock.mutate({ userId: b.user_id })}
                  />
                }
              />
            ))}
          </Card>
          <Text variant="caption" color="muted">
            Unblocking does not restore follows. Tap a row to see the profile.
          </Text>
        </>
      ) : null}
    </Screen>
  );
}
