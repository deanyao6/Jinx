import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Text } from '@/components/Text';
import { companionLuck, talliesFromRecords } from '@/features/eggs/jinx';
import { useCompanionRecords } from '@/features/people/queries';
import { openShare } from '@/features/share/navigate';
import { formatGameDate } from '@/lib/format';
import { gamesLabel } from '../copy';
import { CompanionRow } from './CompanionRow';

/** "Your record with" list: companions sorted by games together. */
export function WithSegment({ onLog }: { onLog: () => void }) {
  const router = useRouter();
  const records = useCompanionRecords();
  // The certified jinx egg. Your own records only, and an empty map when it is switched off.
  const luck = useMemo(() => companionLuck(talliesFromRecords(records.data ?? [])), [records.data]);

  if (records.isPending) return <Loading label="Loading companions" />;
  if (records.isError) return <ErrorNotice error={records.error} onRetry={records.refetch} />;
  const list = records.data;
  if (list.length === 0) {
    return (
      <EmptyState
        title="Nobody tagged yet"
        body="Tag the people you go with when you log a game. Dad does not need the app to end up on this list."
        actionTitle="Log a game"
        onAction={onLog}
      />
    );
  }
  return (
    <>
      <Card label="Your record with">
        {list.map((p, i) => (
          <CompanionRow
            key={p.person_id}
            personId={p.linked_user_id ?? p.person_id}
            avatarPath={p.linked_avatar_path}
            first={i === 0}
            name={p.display_name}
            subtitle={
              p.games
                ? `${gamesLabel(p.games)}${p.last_game ? ` · last ${formatGameDate(p.last_game)}` : ''}${p.linked_handle ? ` · @${p.linked_handle}` : ''}`
                : p.linked_handle
                  ? `@${p.linked_handle} · no games together yet`
                  : 'No games together yet'
            }
            wins={p.wins}
            losses={p.losses}
            ties={p.ties}
            games={p.games}
            linked={!!p.linked_user_id}
            luck={luck.get(p.person_id)}
            onPress={() => router.push(`/friends/person/${p.person_id}`)}
            onShare={
              p.games
                ? () =>
                    openShare(router, {
                      kind: 'companion',
                      name: p.display_name,
                      wins: p.wins,
                      losses: p.losses,
                      ties: p.ties,
                      games: p.games,
                    })
                : undefined
            }
          />
        ))}
      </Card>
      <Text variant="caption" color="muted">
        Records count games where you had a side. Who’s lucky, who’s a jinx.
      </Text>
    </>
  );
}
