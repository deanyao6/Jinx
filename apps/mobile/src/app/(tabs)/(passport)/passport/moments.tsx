import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { momentRows } from '@/features/passport/format';
import { useMyStats } from '@/features/passport/queries';
import { CountHero } from '@/features/passport/ui/CountHero';
import { MomentTrophies, unearnedMoments } from '@/features/passport/ui/MomentTrophies';
import { useTheme } from '@/theme/ThemeProvider';

export default function MomentsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const stats = useMyStats();
  const rows = momentRows(stats.data?.moments ?? []);
  const total = rows.reduce((n, r) => n + r.count, 0);

  // Ghosts only for the sports this person goes to: no pick six on a baseball fan's shelf.
  const sports = useMemo(
    () => Array.from(new Set((stats.data?.stamps ?? []).flatMap((s) => s.sports))),
    [stats.data],
  );
  const earned = rows.filter((r) => r.count > 0);
  const ghosts = unearnedMoments(
    earned.map((r) => r.type),
    sports,
  ).map((m) => ({ ...m, count: 0 }));
  const kinds = earned.length + ghosts.length;

  return (
    <Screen>
      {stats.isPending ? <Loading /> : null}
      {stats.isError ? <ErrorNotice error={stats.error} onRetry={stats.refetch} /> : null}
      {stats.data && rows.length === 0 ? (
        <EmptyState
          icon="i-bolt"
          title="No moments yet"
          body="Walk-offs, grand slams, no-hitters, overtime and more are detected from the games you attend."
        />
      ) : null}
      {rows.length > 0 ? (
        <>
          <CountHero
            kicker="You were there"
            value={String(total)}
            unit={total === 1 ? 'moment witnessed' : 'moments witnessed'}
          />
          <View style={{ marginBottom: theme.spacing.xl, gap: 6 }}>
            <ProgressBar value={kinds > 0 ? earned.length / kinds : 0} done={ghosts.length === 0} />
            <Text variant="caption" color="muted">
              {earned.length} of {kinds} kinds collected
            </Text>
          </View>
          <MomentTrophies
            trophies={earned}
            onPress={(type) => router.push(`/passport/moment/${type}`)}
          />
        </>
      ) : null}
      {rows.length > 0 && ghosts.length > 0 ? (
        <View style={{ marginTop: theme.spacing.xl }}>
          <SectionHeader title="Still to witness" />
          <MomentTrophies trophies={ghosts} />
        </View>
      ) : null}
    </Screen>
  );
}
