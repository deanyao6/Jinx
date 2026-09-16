import { useRouter } from 'expo-router';
import React from 'react';

import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Text } from '@/components/Text';
import { useOverlaps } from '../queries';
import { OverlapCard } from './OverlapCard';

export function OverlapSegment({ onFindPeople }: { onFindPeople: () => void }) {
  const router = useRouter();
  const overlaps = useOverlaps();
  if (overlaps.isPending) return <Loading label="Looking for overlaps" />;
  if (overlaps.isError) return <ErrorNotice error={overlaps.error} onRetry={overlaps.refetch} />;
  if (overlaps.data.length === 0) {
    return (
      <EmptyState
        title="No overlaps yet"
        body="When you and a friend who follow each other were at the same game, it shows up here, including games from before you connected."
        actionTitle="Find people"
        onAction={onFindPeople}
      />
    );
  }
  const before = overlaps.data.filter((o) => o.before_connected);
  const after = overlaps.data.filter((o) => !o.before_connected);
  const render = (list: typeof overlaps.data) =>
    list.map((o) => (
      <OverlapCard
        key={`${o.other_user_id}-${o.game_id}`}
        overlap={o}
        onOpenGame={() => router.push(`/games/${o.game_id}`)}
        onOpenProfile={() => router.push(`/u/${o.other_handle}`)}
      />
    ));
  return (
    <>
      {render(before)}
      {after.length ? (
        <>
          {before.length ? (
            <Text
              variant="label"
              color="muted"
              style={{ marginBottom: 8, textTransform: 'uppercase' }}
            >
              Since you connected
            </Text>
          ) : null}
          {render(after)}
        </>
      ) : null}
      <Text variant="caption" color="muted">
        Section gaps appear only when both of you share seats.
      </Text>
    </>
  );
}
