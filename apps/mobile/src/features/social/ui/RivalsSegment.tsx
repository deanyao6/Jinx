import { useRouter } from 'expo-router';
import React from 'react';

import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Text } from '@/components/Text';
import { useRivalries } from '../queries';
import { RivalryCard } from './RivalryCard';

export function RivalsSegment({ onFindPeople }: { onFindPeople: () => void }) {
  const router = useRouter();
  const rivalries = useRivalries();
  if (rivalries.isPending) return <Loading label="Checking rivalries" />;
  if (rivalries.isError) return <ErrorNotice error={rivalries.error} onRetry={rivalries.refetch} />;
  if (rivalries.data.length === 0) {
    return (
      <EmptyState
        title="No rivalries yet"
        body="A rivalry starts when you and a friend follow each other and your teams have met. Head-to-head counts games you both attended on opposite sides."
        actionTitle="Find people"
        onAction={onFindPeople}
      />
    );
  }
  return (
    <>
      {rivalries.data.map((r) => (
        <RivalryCard
          key={r.rival_user_id}
          rivalry={r}
          onOpen={() => router.push(`/u/${r.rival_handle}`)}
        />
      ))}
      <Text variant="caption" color="muted">
        Together means you both tagged each other or both checked in. Apart is everything else.
      </Text>
    </>
  );
}
