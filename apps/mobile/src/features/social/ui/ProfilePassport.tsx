import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { isEmptyStats, parseStats, superlativeRows } from '@/features/passport/format';
import { PassportRecordCard, StampsGrid, SuperlativesList } from '@/features/passport/ui';

type Props = { stats: unknown; name: string };

/** Another user's passport (record, stamps, superlatives) from their user_stats_cache payload. */
export function ProfilePassport({ stats, name }: Props) {
  const router = useRouter();
  const s = useMemo(() => parseStats(stats), [stats]);
  const superlatives = useMemo(() => superlativeRows(s.superlatives, s.moments, s.streaks), [s]);
  if (isEmptyStats(s)) {
    return (
      <Card label="Passport">
        <Text variant="sub" color="muted">
          {name} hasn’t logged a game yet.
        </Text>
      </Card>
    );
  }
  return (
    <>
      <PassportRecordCard overall={s.overall} teams={s.teams} pledge={s.pledge} />
      <Card label={`Venue stamps · ${s.stamps.length}`}>
        <StampsGrid stamps={s.stamps} limit={12} />
      </Card>
      {superlatives.length > 0 ? (
        <Card label="Superlatives">
          <SuperlativesList
            rows={superlatives}
            limit={6}
            onPressRow={(row) => {
              if (row.gameId) router.push(`/games/${row.gameId}`);
            }}
          />
        </Card>
      ) : null}
      <Text variant="caption" color="muted">
        {s.totals.games === 1 ? '1 game' : `${s.totals.games} games`} at {s.totals.venues}{' '}
        {s.totals.venues === 1 ? 'venue' : 'venues'}
        {s.players_seen ? ` · ${s.players_seen} players seen` : ''}
      </Text>
    </>
  );
}
