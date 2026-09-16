import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { GameRow } from '@/components/GameRow';
import { Loading } from '@/components/Loading';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Text } from '@/components/Text';
import { openShare } from '@/features/share/navigate';
import { sportLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { formatShortDate, visitsLabel } from '../format';
import { useVenueGames } from '../queries';
import type { StatsStamp } from '../types';
import { Sheet } from './Sheet';

type Props = {
  stamp: StatsStamp | null;
  onClose: () => void;
  /** Position among all stamps (1-based), for the "Stamp #14" share card. */
  stampNumber?: number | null;
};

/** Venue sheet: visits, first visit, sports seen, and the games you attended there. */
export function VenueSheet({ stamp, onClose, stampNumber = null }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const games = useVenueGames(stamp?.venue_id ?? null);
  const place = [stamp?.city, stamp?.state].filter(Boolean).join(', ');
  return (
    <Sheet visible={!!stamp} title={stamp?.name ?? ''} subtitle={place} onClose={onClose}>
      {stamp ? (
        <>
          <View
            style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}
          >
            <Fact label="Visits" value={String(stamp.visits)} />
            <Fact
              label="First visit"
              value={stamp.first_visit ? formatShortDate(stamp.first_visit) : '—'}
            />
            <Fact
              label={stamp.closed ? 'Status' : 'Sports'}
              value={stamp.closed ? 'Closed' : stamp.sports.map(sportLabel).join(', ') || '—'}
            />
          </View>
          <Card label={`Your games here, ${visitsLabel(stamp.visits)}`}>
            {games.isPending ? <Loading /> : null}
            {games.isError ? <ErrorNotice error={games.error} onRetry={games.refetch} /> : null}
            {(games.data ?? []).map((row, i) => (
              <GameRow
                key={row.attendance_id}
                first={i === 0}
                game={{
                  ...row.game,
                  awayName: row.game.away?.name ?? 'Away',
                  homeName: row.game.home?.name ?? 'Home',
                  venueName: null,
                }}
                onPress={() => {
                  onClose();
                  router.push(`/games/${row.game.id}`);
                }}
              />
            ))}
            {games.data && games.data.length === 0 ? (
              <Text variant="sub" color="muted">
                No games logged here yet.
              </Text>
            ) : null}
          </Card>
          <Button
            title="Share this stamp"
            variant="secondary"
            onPress={() => {
              onClose();
              openShare(router, {
                kind: 'stamp',
                venue: stamp.name,
                place: place || null,
                visits: stamp.visits,
                firstVisit: stamp.first_visit,
                stampCount: stampNumber,
              });
            }}
          />
        </>
      ) : null}
    </Sheet>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.tint,
        borderRadius: theme.radius.md,
        padding: theme.spacing.sm + 2,
      }}
    >
      <Text variant="caption" color="muted">
        {label}
      </Text>
      <Text variant="bodyStrong" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
