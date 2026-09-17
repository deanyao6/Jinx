import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Avatar } from '@/components/reference/Avatar';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
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
          icon="i-eye"
          title="Nobody blocked"
          body="Block someone from the menu on their profile. They vanish from your feed, overlaps, and tags, and you from theirs."
        />
      ) : null}
      {blocked.data && blocked.data.length > 0 ? (
        <>
          <SectionHeader
            title={blocked.data.length === 1 ? '1 person' : `${blocked.data.length} people`}
          />
          <Card>
            {blocked.data.map((b) => {
              const name = b.display_name?.trim() || `@${b.handle}`;
              return (
                <View key={b.user_id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, overflow: 'hidden' }}>
                    <Avatar name={name} size={38} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Row
                      title={name}
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
                  </View>
                </View>
              );
            })}
          </Card>
          <Text variant="caption" color="muted">
            Unblocking does not restore follows. Tap a row to see the profile.
          </Text>
        </>
      ) : null}
    </Screen>
  );
}
