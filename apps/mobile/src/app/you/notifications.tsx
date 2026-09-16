import { Stack, useRouter, type Href } from 'expo-router';
import React, { useEffect, useRef } from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import {
  notificationRoute,
  useMarkNotificationsRead,
  useNotifications,
} from '@/features/notifications/queries';
import { formatGameDate, formatGameTime } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const list = useNotifications();
  const markRead = useMarkNotificationsRead();
  const marked = useRef(false);

  // Opening the list marks everything read once the first page has loaded.
  useEffect(() => {
    if (marked.current || !list.data) return;
    if (list.data.some((n) => !n.read_at)) {
      marked.current = true;
      markRead.mutate(undefined);
    }
  }, [list.data, markRead]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <Button
        title="Notification settings"
        variant="secondary"
        small
        onPress={() => router.push('/you/notification-settings')}
        style={{ alignSelf: 'flex-start', marginBottom: theme.spacing.md }}
      />
      {list.isPending ? <Loading label="Loading" /> : null}
      {list.isError ? (
        <ErrorNotice
          error={list.error}
          message="Could not load notifications."
          onRetry={list.refetch}
        />
      ) : null}
      {list.data && list.data.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          body="Pledge results, game-day reminders, and imports that need a look show up here."
        />
      ) : null}
      {list.data && list.data.length ? (
        <Card>
          {list.data.map((n, i) => {
            const route = notificationRoute(n);
            return (
              <Row
                key={n.id}
                first={i === 0}
                title={n.title}
                subtitle={`${n.body}\n${formatGameDate(n.created_at)}, ${formatGameTime(n.created_at)}`}
                chevron={!!route}
                right={
                  !n.read_at ? (
                    <Text variant="label" color="red">
                      New
                    </Text>
                  ) : null
                }
                onPress={route ? () => router.push(route as Href) : undefined}
              />
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}
