import { Stack, useRouter, type Href } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { IconTile } from '@/components/IconTile';
import { Loading } from '@/components/Loading';
import { IconChevR } from '@/components/reference/icons';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { notificationIcon } from '@/features/account/ui/notificationIcon';
import {
  notificationRoute,
  useMarkNotificationsRead,
  useNotifications,
  type Notification,
} from '@/features/notifications/queries';
import { formatGameDate, formatGameTime } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

/** One alert: a tile for its kind, what happened, when. A new one sits on the team's wash. */
function AlertCard({ n, fresh, onOpen }: { n: Notification; fresh: boolean; onOpen?: () => void }) {
  const theme = useTheme();
  const body = (
    <Card
      tone={fresh ? 'accent' : 'plain'}
      style={{ padding: theme.spacing.md, marginBottom: theme.spacing.sm }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <IconTile icon={notificationIcon(n.kind)} solid={fresh} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{n.title}</Text>
          <Text variant="sub" color="muted" style={{ marginTop: 1 }}>
            {n.body}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            {fresh ? (
              <>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: theme.accent.text,
                  }}
                />
                <Text variant="caption" color="accent" weight={750}>
                  New
                </Text>
              </>
            ) : null}
            <Text variant="caption" color="muted">
              {formatGameDate(n.created_at)}, {formatGameTime(n.created_at)}
            </Text>
          </View>
        </View>
        {onOpen ? (
          <View style={{ alignSelf: 'center' }}>
            <IconChevR size={16} color={theme.colors.muted} />
          </View>
        ) : null}
      </View>
    </Card>
  );
  if (!onOpen) return body;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {body}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const list = useNotifications();
  const markRead = useMarkNotificationsRead();
  const marked = useRef(false);

  // Opening the list marks everything read at once, and the cache is updated before the round
  // trip, so by the first paint nothing is unread any more. What was new when you arrived is
  // remembered here, for display only, so the highlight lasts as long as the visit does.
  const [fresh, setFresh] = useState<ReadonlySet<string> | null>(null);
  if (fresh === null && list.data) {
    setFresh(new Set(list.data.filter((n) => !n.read_at).map((n) => n.id)));
  }

  // Opening the list marks everything read once the first page has loaded.
  useEffect(() => {
    if (marked.current || !list.data) return;
    if (list.data.some((n) => !n.read_at)) {
      marked.current = true;
      markRead.mutate(undefined);
    }
  }, [list.data, markRead]);

  const isFresh = (n: Notification) => !n.read_at || (fresh?.has(n.id) ?? false);
  const newCount = (list.data ?? []).filter(isFresh).length;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <SectionHeader
        title={newCount > 0 ? `${newCount} new` : 'Recent'}
        action="Notification settings"
        onAction={() => router.push('/you/notification-settings')}
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
          icon="i-bell"
          title="Nothing yet"
          body="Pledge results, game-day reminders, and imports that need a look show up here."
        />
      ) : null}
      {(list.data ?? []).map((n) => {
        const route = notificationRoute(n);
        return (
          <AlertCard
            key={n.id}
            n={n}
            fresh={isFresh(n)}
            onOpen={route ? () => router.push(route as Href) : undefined}
          />
        );
      })}
    </Screen>
  );
}
