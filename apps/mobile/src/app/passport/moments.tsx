import { useRouter } from 'expo-router';
import React from 'react';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { momentRows } from '@/features/passport/format';
import { useMyStats } from '@/features/passport/queries';

export default function MomentsScreen() {
  const router = useRouter();
  const stats = useMyStats();
  const rows = momentRows(stats.data?.moments ?? []);
  const total = rows.reduce((n, r) => n + r.count, 0);
  return (
    <Screen>
      {stats.isPending ? <Loading /> : null}
      {stats.isError ? <ErrorNotice error={stats.error} onRetry={stats.refetch} /> : null}
      {stats.data && rows.length === 0 ? (
        <EmptyState
          title="No moments yet"
          body="Walk-offs, grand slams, no-hitters, overtime and more are detected from the games you attend."
        />
      ) : null}
      {rows.length > 0 ? (
        <Card label={`${total} moments witnessed`}>
          {rows.map((m, i) => (
            <Row
              key={m.type}
              first={i === 0}
              chevron
              title={m.label}
              right={
                <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                  {m.count}
                </Text>
              }
              onPress={() => router.push(`/passport/moment/${m.type}`)}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
